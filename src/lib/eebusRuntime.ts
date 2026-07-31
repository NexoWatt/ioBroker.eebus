import { EebusConfig } from './config';
import { DiscoveryService } from './discoveryService';
import { DeviceClass, DeviceCommand, DiscoveredShipNode, EebusIdentity, ShipConnectionState } from './eebusTypes';
import { ObjectFactory } from './objectFactory';
import { ShipEndpoint } from './shipEndpoint';
import { analyzeSpineMessage } from './spineParser';
import { jsonStringifySafe, safeId } from './sanitizer';
import { buildNodeManagementDetailedDiscoveryRequest, mapCommandToSpineDraft } from './spineMapper';
import { classifyFromDiscovery } from './useCaseRegistry';

export class EebusRuntime {
    private readonly nodes = new Map<string, DiscoveredShipNode>();
    private discovery?: DiscoveryService;
    private endpoint?: ShipEndpoint;
    private measurementInterval?: any;
    private metadataInterval?: any;
    private msgCounter = 1;
    private autoAcceptNewDevices: boolean;

    public constructor(
        private readonly adapter: any,
        private readonly config: EebusConfig,
        private readonly identity: EebusIdentity,
        private readonly objectFactory: ObjectFactory,
    ) {
        this.autoAcceptNewDevices = config.autoAcceptNewDevices;
    }

    public async start(): Promise<void> {
        this.endpoint = new ShipEndpoint(
            this.adapter,
            { ...this.config, autoAcceptNewDevices: this.autoAcceptNewDevices },
            this.identity,
            async (deviceId, message) => this.handleIncomingMessage(deviceId, message),
            async node => this.handleDiscoveredNode(node),
            async (deviceId, state, role, connected, error) => this.handleConnectionState(deviceId, state, role, connected, error),
            async deviceId => this.handleDataExchangeReady(deviceId),
            async (deviceId, request) => this.handlePairingRequest(deviceId, request),
            async deviceId => this.isTrusted(deviceId),
        );
        const endpointStarted = await this.endpoint.start();

        this.discovery = new DiscoveryService(this.adapter, this.config, async node => this.handleDiscoveredNode(node));
        this.discovery.start();

        this.measurementInterval = this.adapter.setInterval(
            () => void this.refreshMeasurements(),
            this.config.measurementIntervalSec * 1000,
        );
        this.metadataInterval = this.adapter.setInterval(() => void this.refreshMetadata(), this.config.metadataIntervalSec * 1000);

        await this.adapter.setStateAsync('info.connection', { val: endpointStarted || this.config.discoveryEnabled, ack: true });
        await this.adapter.setStateAsync('identity.announcementActive', {
            val: endpointStarted && this.config.announceShipService,
            ack: true,
        });
        await this.adapter.setStateAsync('discovery.enabled', { val: this.config.discoveryEnabled, ack: true });
        await this.adapter.setStateAsync('pairing.autoAcceptNewDevices', { val: this.autoAcceptNewDevices, ack: true });
    }

    public async stop(): Promise<void> {
        if (this.measurementInterval) {
            this.adapter.clearInterval(this.measurementInterval);
            this.measurementInterval = undefined;
        }

        if (this.metadataInterval) {
            this.adapter.clearInterval(this.metadataInterval);
            this.metadataInterval = undefined;
        }

        this.discovery?.stop();
        this.discovery = undefined;

        await this.endpoint?.stop();
        this.endpoint = undefined;

        await this.adapter.setStateAsync('identity.announcementActive', { val: false, ack: true });
        await this.adapter.setStateAsync('info.connection', { val: false, ack: true });
    }

    public async handleStateChange(id: string, state: ioBroker.State): Promise<void> {
        if (!state || state.ack) return;

        if (id.endsWith('.pairing.autoAcceptNewDevices')) {
            this.autoAcceptNewDevices = Boolean(state.val);
            await this.adapter.setStateAsync('pairing.autoAcceptNewDevices', { val: this.autoAcceptNewDevices, ack: true });
            this.adapter.log.warn(
                `Global EEBUS auto-accept for new devices is now ${this.autoAcceptNewDevices ? 'enabled' : 'disabled'}. ` +
                    'Use only during field tests and switch it off for production.',
            );
            return;
        }

        const command = this.parseCommand(id, state.val);
        if (!command) return;

        await this.processCommand(command);
    }

    private async processCommand(command: DeviceCommand): Promise<void> {
        if (command.channel === 'control' && command.stateName === 'connect') {
            if (Boolean(command.value)) await this.connectDevice(command.deviceId);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.control.connect`, { val: false, ack: true });
            return;
        }

        if (command.channel === 'control' && command.stateName === 'disconnect') {
            if (Boolean(command.value)) this.endpoint?.disconnect(command.deviceId);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.control.disconnect`, { val: false, ack: true });
            return;
        }

        if (command.channel === 'control' && command.stateName === 'refreshNodeManagement') {
            if (Boolean(command.value)) await this.requestNodeManagement(command.deviceId);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.control.refreshNodeManagement`, { val: false, ack: true });
            return;
        }

        if (command.channel === 'pairing' && ['trusted', 'approve', 'reject'].includes(command.stateName)) {
            const trusted = command.stateName === 'reject' ? false : Boolean(command.value);
            await this.objectFactory.publishTrust(command.deviceId, trusted, command.stateName === 'approve' ? 'local-approve-button' : 'local-user');
            if (trusted) {
                await this.endpoint?.approveDevice(command.deviceId);
            } else if (command.stateName === 'reject') {
                this.endpoint?.rejectDevice(command.deviceId);
            }
            await this.adapter.setStateAsync(`devices.${command.deviceId}.pairing.approve`, { val: false, ack: true });
            await this.adapter.setStateAsync(`devices.${command.deviceId}.pairing.reject`, { val: false, ack: true });
            await this.objectFactory.publishGlobalPairingCounts(Array.from(this.nodes.keys()));
            return;
        }

        const node = this.nodes.get(command.deviceId);
        const commandDraft = mapCommandToSpineDraft(command, this.identity, node?.id, this.nextMsgCounter());
        const commandStateId = `devices.${command.deviceId}.raw.lastCommand`;
        await this.adapter.setStateAsync(commandStateId, { val: jsonStringifySafe(commandDraft), ack: true });

        const trusted = await this.isTrusted(command.deviceId);
        if (!trusted && !this.config.allowCommandsToUntrustedDevices) {
            const msg = 'Command not sent because the device is not trusted. Set pairing.trusted first or enable allowCommandsToUntrustedDevices.';
            this.adapter.log.warn(`${command.deviceId}: ${msg}`);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.raw.lastError`, { val: msg, ack: true });
            return;
        }

        if (this.config.commandDryRun) {
            const msg = 'Command dry run is enabled. Field-test SPINE command was recorded but not sent.';
            this.adapter.log.info(`${command.deviceId}: ${msg}`);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.raw.lastError`, { val: msg, ack: true });
            return;
        }

        const payload = commandDraft.datagram || commandDraft;
        const sent = this.endpoint?.sendSpine(command.deviceId, payload) || false;
        if (!sent) {
            const msg = 'No active SHIP data-exchange session for this device. Command was not sent.';
            this.adapter.log.warn(`${command.deviceId}: ${msg}`);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.raw.lastError`, { val: msg, ack: true });
            return;
        }

        await this.adapter.setStateAsync(`devices.${command.deviceId}.${command.channel}.${command.stateName}`, {
            val: command.value,
            ack: true,
        });
    }

    private async handleDiscoveredNode(node: DiscoveredShipNode): Promise<void> {
        if (this.isLocalNode(node)) return;

        node.deviceClass = node.deviceClass || classifyFromDiscovery(node);
        this.nodes.set(node.safeId, node);
        await this.objectFactory.publishDiscovery(node);
        await this.adapter.setStateAsync('discovery.discoveredCount', { val: this.nodes.size, ack: true });
        await this.adapter.setStateAsync('discovery.lastDiscovery', { val: jsonStringifySafe(node), ack: true });
        await this.objectFactory.publishGlobalPairingCounts(Array.from(this.nodes.keys()));

        if (this.config.autoConnectEnabled && node.serviceType !== 'incoming') {
            void this.connectDevice(node.safeId);
        }
    }

    private async connectDevice(deviceId: string): Promise<void> {
        const node = this.nodes.get(deviceId);
        if (!node) {
            await this.adapter.setStateAsync(`devices.${deviceId}.connection.lastError`, { val: 'Device is unknown or has no mDNS target.', ack: true });
            return;
        }
        await this.endpoint?.connectToNode(node);
    }

    private async handleConnectionState(
        deviceId: string,
        state: ShipConnectionState,
        role: 'client' | 'server',
        connected: boolean,
        error = '',
    ): Promise<void> {
        await this.objectFactory.publishConnectionState(deviceId, state, role, connected, error);
        if (state === 'data-exchange') await this.adapter.setStateAsync(`devices.${deviceId}.pairing.pairingState`, { val: 'paired-data-exchange', ack: true });
    }

    private async handlePairingRequest(deviceId: string, request: unknown): Promise<void> {
        await this.objectFactory.publishPairingRequest(deviceId, request);
        if (this.autoAcceptNewDevices) {
            await this.objectFactory.publishTrust(deviceId, true, 'auto-accept-field-test');
            await this.endpoint?.approveDevice(deviceId);
        }
        await this.objectFactory.publishGlobalPairingCounts(Array.from(this.nodes.keys()));
    }

    private async handleDataExchangeReady(deviceId: string): Promise<void> {
        await this.adapter.setStateAsync(`devices.${deviceId}.pairing.pairingState`, { val: 'paired-data-exchange', ack: true });
        if (this.config.spineDiscoveryEnabled) await this.requestNodeManagement(deviceId);
    }

    private async requestNodeManagement(deviceId: string): Promise<void> {
        const node = this.nodes.get(deviceId);
        if (!node) return;
        const datagram = buildNodeManagementDetailedDiscoveryRequest(this.identity, node.id, this.nextMsgCounter());
        await this.adapter.setStateAsync(`devices.${deviceId}.raw.lastCommand`, { val: jsonStringifySafe(datagram), ack: true });
        // NodeManagement discovery is read-only and required to identify device classes/use cases during field tests.
        // commandDryRun only blocks write/control commands, not this read request.
        const sent = this.endpoint?.sendSpine(deviceId, datagram) || false;
        if (!sent) {
            await this.adapter.setStateAsync(`devices.${deviceId}.raw.lastError`, {
                val: 'Could not send NodeManagement discovery request because no SHIP data-exchange session is active.',
                ack: true,
            });
        }
    }

    private async handleIncomingMessage(deviceId: string, message: unknown): Promise<void> {
        const safeDeviceId = safeId(deviceId);
        await this.ensureIncomingDevice(safeDeviceId);

        if (this.config.debugRawMessages) {
            await this.adapter.setStateAsync(`devices.${safeDeviceId}.raw.lastMessage`, { val: jsonStringifySafe(message), ack: true });
        }

        const messageRecord = message && typeof message === 'object' ? (message as Record<string, any>) : {};
        if (messageRecord.pinState?.pinState) {
            await this.adapter.setStateAsync(`devices.${safeDeviceId}.pairing.pinState`, { val: String(messageRecord.pinState.pinState), ack: true });
            return;
        }

        const maybeFrame = messageRecord.shipFrame;
        if (maybeFrame) {
            await this.adapter.setStateAsync(`devices.${safeDeviceId}.raw.lastShipFrame`, { val: jsonStringifySafe(maybeFrame), ack: true });
            return;
        }

        await this.adapter.setStateAsync(`devices.${safeDeviceId}.raw.lastDataPayload`, { val: jsonStringifySafe(message), ack: true });
        const fallbackClass = (this.nodes.get(safeDeviceId)?.deviceClass || 'unknown') as DeviceClass;
        const analysis = analyzeSpineMessage(message, fallbackClass);
        if (analysis.rawPayload) await this.adapter.setStateAsync(`devices.${safeDeviceId}.raw.lastSpineFrame`, { val: jsonStringifySafe(analysis.rawPayload), ack: true });

        if (analysis.featureSummary) {
            const node = this.nodes.get(safeDeviceId);
            if (node) node.deviceClass = analysis.featureSummary.deviceClass;
            await this.objectFactory.publishFeatureSummary(safeDeviceId, analysis.featureSummary);
        }

        for (const update of analysis.measurementUpdates) {
            await this.objectFactory.publishMeasurement(safeDeviceId, update.stateId, update.value);
        }
    }

    private async ensureIncomingDevice(deviceId: string): Promise<void> {
        if (this.nodes.has(deviceId)) return;
        const node: DiscoveredShipNode = {
            id: deviceId,
            safeId: deviceId,
            name: `EEBUS ${deviceId.slice(0, 12)}`,
            host: '',
            port: 0,
            path: this.config.shipPath,
            ski: '',
            brand: '',
            type: '',
            model: '',
            serial: '',
            categories: [],
            register: true,
            ecc: false,
            txt: {},
            serviceType: 'incoming',
            lastSeen: new Date().toISOString(),
            deviceClass: 'unknown',
        };
        this.nodes.set(deviceId, node);
        await this.objectFactory.publishDiscovery(node);
    }

    private async refreshMeasurements(): Promise<void> {
        const now = Date.now();
        for (const [deviceId, node] of this.nodes.entries()) {
            const ageMs = now - Date.parse(node.lastSeen);
            const online = Number.isFinite(ageMs) ? ageMs < this.config.metadataIntervalSec * 3000 : true;
            await this.adapter.setStateAsync(`devices.${deviceId}.info.online`, { val: online, ack: true });
        }
    }

    private async refreshMetadata(): Promise<void> {
        for (const node of this.nodes.values()) await this.objectFactory.publishDiscovery(node);
        await this.objectFactory.publishGlobalPairingCounts(Array.from(this.nodes.keys()));
    }

    private parseCommand(id: string, value: unknown): DeviceCommand | null {
        const match = id.match(/(?:^|\.)devices\.([^.]+)\.(control|limits|pairing)\.([^.]+)$/);
        if (!match) return null;

        return {
            deviceId: match[1],
            channel: match[2] as DeviceCommand['channel'],
            stateName: match[3],
            value,
            ts: new Date().toISOString(),
        };
    }

    private async isTrusted(deviceId: string): Promise<boolean> {
        if (this.autoAcceptNewDevices) return true;
        const state = await this.adapter.getStateAsync(`devices.${deviceId}.pairing.trusted`);
        return Boolean(state?.val);
    }

    private isLocalNode(node: DiscoveredShipNode): boolean {
        return Boolean(
            (node.ski && node.ski === this.identity.localSki) ||
                (node.id && node.id === this.identity.shipId) ||
                (node.txt?.ski && node.txt.ski === this.identity.localSki),
        );
    }

    private nextMsgCounter(): number {
        this.msgCounter += 1;
        if (this.msgCounter > 2147483640) this.msgCounter = 1;
        return this.msgCounter;
    }
}
