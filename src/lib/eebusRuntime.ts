import { EebusConfig } from './config';
import { DiscoveryService } from './discoveryService';
import { DeviceCommand, DiscoveredShipNode, EebusIdentity } from './eebusTypes';
import { ObjectFactory } from './objectFactory';
import { ShipEndpoint } from './shipEndpoint';
import { jsonStringifySafe, safeId } from './sanitizer';
import { mapCommandToSpineDraft } from './spineMapper';

export class EebusRuntime {
    private readonly nodes = new Map<string, DiscoveredShipNode>();
    private discovery?: DiscoveryService;
    private endpoint?: ShipEndpoint;
    private measurementInterval?: any;
    private metadataInterval?: any;

    public constructor(
        private readonly adapter: any,
        private readonly config: EebusConfig,
        private readonly identity: EebusIdentity,
        private readonly objectFactory: ObjectFactory,
    ) {}

    public async start(): Promise<void> {
        this.endpoint = new ShipEndpoint(this.adapter, this.config, this.identity, async (deviceId, message) =>
            this.handleIncomingMessage(deviceId, message),
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
        await this.adapter.setStateAsync('discovery.enabled', { val: this.config.discoveryEnabled, ack: true });
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

        await this.adapter.setStateAsync('info.connection', { val: false, ack: true });
    }

    public async handleStateChange(id: string, state: ioBroker.State): Promise<void> {
        if (!state || state.ack) {
            return;
        }

        const command = this.parseCommand(id, state.val);
        if (!command) {
            return;
        }

        const commandDraft = mapCommandToSpineDraft(command);
        const commandStateId = `devices.${command.deviceId}.raw.lastCommand`;
        await this.adapter.setStateAsync(commandStateId, { val: jsonStringifySafe(commandDraft), ack: true });

        if (command.channel === 'pairing' && command.stateName === 'trusted') {
            await this.adapter.setStateAsync(`devices.${command.deviceId}.pairing.trusted`, { val: Boolean(command.value), ack: true });
            await this.adapter.setStateAsync(`devices.${command.deviceId}.pairing.pairingState`, {
                val: Boolean(command.value) ? 'trusted-local' : 'untrusted-local',
                ack: true,
            });
            return;
        }

        const trusted = await this.isTrusted(command.deviceId);
        if (!trusted && !this.config.allowCommandsToUntrustedDevices) {
            const msg = 'Command not sent because the device is not trusted. Set pairing.trusted first or enable allowCommandsToUntrustedDevices.';
            this.adapter.log.warn(`${command.deviceId}: ${msg}`);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.raw.lastError`, { val: msg, ack: true });
            return;
        }

        if (this.config.commandDryRun) {
            const msg = 'Command dry run is enabled. Draft SPINE command was recorded but not sent.';
            this.adapter.log.info(`${command.deviceId}: ${msg}`);
            await this.adapter.setStateAsync(`devices.${command.deviceId}.raw.lastError`, { val: msg, ack: true });
            return;
        }

        const sent = this.endpoint?.send(command.deviceId, commandDraft) || false;
        if (!sent) {
            const msg = 'No active SHIP WebSocket connection for this device. Command was not sent.';
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
        this.nodes.set(node.safeId, node);
        await this.objectFactory.publishDiscovery(node);
        await this.adapter.setStateAsync('discovery.discoveredCount', { val: this.nodes.size, ack: true });
        await this.adapter.setStateAsync('discovery.lastDiscovery', { val: jsonStringifySafe(node), ack: true });
    }

    private async handleIncomingMessage(deviceId: string, message: unknown): Promise<void> {
        const safeDeviceId = safeId(deviceId);
        if (this.config.debugRawMessages) {
            await this.adapter.setStateAsync(`devices.${safeDeviceId}.raw.lastMessage`, {
                val: jsonStringifySafe(message),
                ack: true,
            });
        }
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
        for (const node of this.nodes.values()) {
            await this.objectFactory.publishDiscovery(node);
        }
    }

    private parseCommand(id: string, value: unknown): DeviceCommand | null {
        const match = id.match(/(?:^|\\.)devices\\.([^.]+)\\.(control|limits|pairing)\\.([^.]+)$/);
        if (!match) {
            return null;
        }

        return {
            deviceId: match[1],
            channel: match[2] as DeviceCommand['channel'],
            stateName: match[3],
            value,
            ts: new Date().toISOString(),
        };
    }

    private async isTrusted(deviceId: string): Promise<boolean> {
        const state = await this.adapter.getStateAsync(`devices.${deviceId}.pairing.trusted`);
        return Boolean(state?.val);
    }
}
