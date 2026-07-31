import { createServer } from 'node:https';
import { AddressInfo } from 'node:net';
import { X509Certificate, createHash } from 'node:crypto';
import { EebusConfig } from './config';
import { DiscoveredShipNode, EebusIdentity, ShipConnectionState } from './eebusTypes';
import { safeId } from './sanitizer';
import {
    DecodedShipFrame,
    decodeShipFrame,
    encodeCmiFrame,
    encodeControlFrame,
    encodeDataFrame,
    encodeEndFrame,
    makeHello,
    makePinError,
    makePinInput,
    makePinState,
    makeProtocolHandshake,
} from './shipFrames';

const SHIP_WEBSOCKET_PROTOCOL = 'ship';

type MessageCallback = (deviceId: string, message: unknown) => void | Promise<void>;
type NodeCallback = (node: DiscoveredShipNode) => void | Promise<void>;
type StateCallback = (deviceId: string, state: ShipConnectionState, role: 'client' | 'server', connected: boolean, error?: string) => void | Promise<void>;
type DataExchangeCallback = (deviceId: string) => void | Promise<void>;
type PairingRequestCallback = (deviceId: string, request: unknown) => void | Promise<void>;
type TrustCallback = (deviceId: string) => Promise<boolean>;

interface ShipSession {
    deviceId: string;
    socket: any;
    role: 'client' | 'server';
    state: ShipConnectionState;
    node?: DiscoveredShipNode;
    remoteSki: string;
    remoteFingerprint: string;
    remoteAddress: string;
    protocolSelected: boolean;
    remoteHelloReady: boolean;
    localHelloReady: boolean;
    dataExchangeReady: boolean;
}

export class ShipEndpoint {
    private server: any;
    private wss: any;
    private bonjour: any;
    private advertisement: any;
    private sockets = new Map<string, any>();
    private sessions = new Map<string, ShipSession>();

    public constructor(
        private readonly adapter: any,
        private readonly config: EebusConfig,
        private readonly identity: EebusIdentity,
        private readonly onMessage: MessageCallback,
        private readonly onNode: NodeCallback,
        private readonly onState: StateCallback,
        private readonly onDataExchange: DataExchangeCallback,
        private readonly onPairingRequest: PairingRequestCallback,
        private readonly isTrusted: TrustCallback,
    ) {}

    public async start(): Promise<boolean> {
        if (!this.config.shipServerEnabled) {
            this.adapter.log.info('Local EOS/HEMS SHIP endpoint is disabled. Wallboxes cannot pair with EOS through EEBUS.');
            return false;
        }

        let WebSocketServer: any;
        try {
            ({ WebSocketServer } = require('ws'));
        } catch (error) {
            this.adapter.log.warn(`ws is not available. Local SHIP endpoint cannot start until dependencies are installed: ${String(error)}`);
            return false;
        }

        return new Promise(resolve => {
            try {
                this.server = createServer({
                    key: this.identity.privateKey,
                    cert: this.identity.certificate,
                    requestCert: true,
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2',
                });

                this.wss = new WebSocketServer({
                    server: this.server,
                    path: this.config.shipPath,
                    perMessageDeflate: false,
                    handleProtocols: (protocols: any) => (protocols.has(SHIP_WEBSOCKET_PROTOCOL) ? SHIP_WEBSOCKET_PROTOCOL : false),
                });

                this.wss.on('connection', (socket: any, request: any) => {
                    void this.registerSocket(socket, request, 'server');
                });

                this.server.on('error', (error: Error) => {
                    this.adapter.log.warn(`Local EOS/HEMS SHIP endpoint could not listen on port ${this.config.shipPort}: ${error.message}`);
                    resolve(false);
                });

                this.server.listen(this.config.shipPort, () => {
                    const address = this.server.address() as AddressInfo;
                    this.adapter.log.info(`Local EOS/HEMS SHIP endpoint listening on port ${address.port}${this.config.shipPath}`);
                    this.publishMdnsIfEnabled(address.port);
                    resolve(true);
                });
            } catch (error) {
                this.adapter.log.warn(`Local EOS/HEMS SHIP endpoint could not start: ${String(error)}`);
                resolve(false);
            }
        });
    }

    public async connectToNode(node: DiscoveredShipNode): Promise<boolean> {
        if (!this.config.autoConnectEnabled) return false;
        if (!node.host || !node.port) return false;
        if (this.sessions.has(node.safeId)) return true;
        if (node.ski && node.ski === this.identity.localSki) return false;
        if (node.id && node.id === this.identity.shipId) return false;

        let WebSocket: any;
        try {
            WebSocket = require('ws');
        } catch (error) {
            this.adapter.log.warn(`ws is not available. Cannot connect to EEBUS node ${node.safeId}: ${String(error)}`);
            return false;
        }

        const path = node.path || '/ship/';
        const url = `wss://${addressForUrl(node.host)}:${node.port}${path}`;
        await this.onState(node.safeId, 'connecting', 'client', false);

        return new Promise(resolve => {
            try {
                const socket = new WebSocket(url, SHIP_WEBSOCKET_PROTOCOL, {
                    rejectUnauthorized: false,
                    cert: this.identity.certificate,
                    key: this.identity.privateKey,
                    minVersion: 'TLSv1.2',
                    perMessageDeflate: false,
                });

                socket.once('open', () => {
                    const session: ShipSession = {
                        deviceId: node.safeId,
                        socket,
                        role: 'client',
                        state: 'tls-connected',
                        node,
                        remoteSki: node.ski,
                        remoteFingerprint: node.fingerprint || '',
                        remoteAddress: `${node.host}:${node.port}`,
                        protocolSelected: false,
                        remoteHelloReady: false,
                        localHelloReady: false,
                        dataExchangeReady: false,
                    };
                    this.attachSession(session);
                    this.sendFrame(session, encodeCmiFrame());
                    void this.setSessionState(session, 'tls-connected', true);
                    resolve(true);
                });

                socket.once('error', (error: Error) => {
                    this.adapter.log.debug(`Could not open SHIP client connection to ${node.safeId} (${url}): ${error.message}`);
                    void this.onState(node.safeId, 'error', 'client', false, error.message);
                    resolve(false);
                });
            } catch (error) {
                void this.onState(node.safeId, 'error', 'client', false, String(error));
                resolve(false);
            }
        });
    }

    public send(deviceId: string, payload: unknown): boolean {
        return this.sendSpine(deviceId, payload);
    }

    public sendSpine(deviceId: string, payload: unknown): boolean {
        const session = this.sessions.get(deviceId);
        if (!session || !this.isSocketOpen(session.socket) || !session.dataExchangeReady) {
            return false;
        }

        this.sendFrame(session, encodeDataFrame(payload));
        return true;
    }

    public disconnect(deviceId: string): boolean {
        const session = this.sessions.get(deviceId);
        if (!session) return false;
        try {
            if (this.isSocketOpen(session.socket)) this.sendFrame(session, encodeEndFrame('unspecific'));
            session.socket.close?.();
            return true;
        } catch (error) {
            this.adapter.log.debug(`Could not disconnect ${deviceId}: ${String(error)}`);
            return false;
        }
    }

    public async approveDevice(deviceId: string): Promise<void> {
        const session = this.sessions.get(deviceId);
        if (!session) return;
        await this.sendHelloForTrust(session);
    }

    public rejectDevice(deviceId: string): void {
        const session = this.sessions.get(deviceId);
        if (!session) return;
        this.sendFrame(session, encodeControlFrame(makeHello('aborted')));
        this.disconnect(deviceId);
    }

    public async stop(): Promise<void> {
        for (const session of this.sessions.values()) {
            try {
                if (this.isSocketOpen(session.socket)) this.sendFrame(session, encodeEndFrame('unspecific'));
                session.socket.close();
            } catch (error) {
                this.adapter.log.debug(`Could not close SHIP socket: ${String(error)}`);
            }
        }

        this.sessions.clear();
        this.sockets.clear();

        try {
            this.advertisement?.stop?.();
        } catch (error) {
            this.adapter.log.debug(`Could not stop SHIP mDNS advertisement: ${String(error)}`);
        }

        try {
            this.bonjour?.destroy?.();
        } catch (error) {
            this.adapter.log.debug(`Could not destroy SHIP mDNS advertiser: ${String(error)}`);
        }

        if (this.wss) {
            await new Promise<void>(resolve => this.wss.close(() => resolve()));
            this.wss = undefined;
        }

        if (this.server) {
            await new Promise<void>(resolve => this.server.close(() => resolve()));
            this.server = undefined;
        }
    }

    private async registerSocket(socket: any, request: any, role: 'server'): Promise<void> {
        const peer = getPeerIdentity(request);
        const safe = safeId(peer.ski || peer.fingerprint || peer.remoteAddress || 'incoming');
        const node: DiscoveredShipNode = {
            id: peer.ski || peer.fingerprint || peer.remoteAddress || safe,
            safeId: safe,
            name: `EEBUS ${safe.slice(0, 12)}`,
            host: peer.remoteAddress,
            port: 0,
            path: this.config.shipPath,
            ski: peer.ski,
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
            fingerprint: peer.fingerprint,
        };

        await this.onNode(node);

        const session: ShipSession = {
            deviceId: safe,
            socket,
            role,
            state: 'tls-connected',
            node,
            remoteSki: peer.ski,
            remoteFingerprint: peer.fingerprint,
            remoteAddress: peer.remoteAddress,
            protocolSelected: false,
            remoteHelloReady: false,
            localHelloReady: false,
            dataExchangeReady: false,
        };
        this.attachSession(session);
        await this.setSessionState(session, 'tls-connected', true);
    }

    private attachSession(session: ShipSession): void {
        this.sessions.set(session.deviceId, session);
        this.sockets.set(session.deviceId, session.socket);
        if (session.remoteSki) this.sockets.set(safeId(session.remoteSki), session.socket);
        if (session.remoteFingerprint) this.sockets.set(safeId(session.remoteFingerprint), session.socket);

        session.socket.on('message', (data: any) => void this.handleFrame(session, decodeShipFrame(data)));
        session.socket.on('close', () => {
            this.sessions.delete(session.deviceId);
            this.sockets.delete(session.deviceId);
            if (session.remoteSki) this.sockets.delete(safeId(session.remoteSki));
            if (session.remoteFingerprint) this.sockets.delete(safeId(session.remoteFingerprint));
            void this.setSessionState(session, 'closed', false);
            this.adapter.log.info(`SHIP WebSocket disconnected from ${session.deviceId}`);
        });
        session.socket.on('error', (error: Error) => {
            void this.setSessionState(session, 'error', false, error.message);
            this.adapter.log.warn(`SHIP WebSocket error from ${session.deviceId}: ${error.message}`);
        });

        this.adapter.log.info(`SHIP WebSocket ${session.role} connected with ${session.deviceId}`);
    }

    private async handleFrame(session: ShipSession, frame: DecodedShipFrame): Promise<void> {
        await this.onMessage(session.deviceId, { shipFrame: frame });

        if (frame.type === 'init') {
            if (session.role === 'server') this.sendFrame(session, encodeCmiFrame());
            await this.setSessionState(session, 'cmi-ok', true);
            await this.sendHelloForTrust(session);
            return;
        }

        if (frame.type === 'control' || frame.type === 'json') {
            await this.handleControl(session, frame.value);
            return;
        }

        if (frame.type === 'data') {
            await this.onMessage(session.deviceId, frame.value);
            return;
        }

        if (frame.type === 'end') {
            this.disconnect(session.deviceId);
        }
    }

    private async handleControl(session: ShipSession, value: unknown): Promise<void> {
        const rec = value && typeof value === 'object' ? (value as Record<string, any>) : {};

        if (rec.connectionHello) {
            const phase = String(rec.connectionHello.phase || '');
            session.remoteHelloReady = phase === 'ready';
            await this.setSessionState(session, phase === 'ready' ? 'hello-ready' : 'hello-pending', true);
            if (phase !== 'ready') await this.onPairingRequest(session.deviceId, { remoteHello: rec.connectionHello, deviceId: session.deviceId });
            if (!session.localHelloReady) await this.sendHelloForTrust(session);
            if (session.remoteHelloReady && session.localHelloReady) await this.startProtocolHandshake(session);
            return;
        }

        if (rec.messageProtocolHandshake) {
            const handshakeType = String(rec.messageProtocolHandshake.handshakeType || '');
            if (session.role === 'server' && handshakeType === 'announceMax') {
                this.sendFrame(session, encodeControlFrame(makeProtocolHandshake('select')));
                return;
            }
            if (session.role === 'client' && handshakeType === 'select') {
                this.sendFrame(session, encodeControlFrame(rec));
                await this.protocolHandshakeOk(session);
                return;
            }
            if (session.role === 'server' && handshakeType === 'select') {
                await this.protocolHandshakeOk(session);
                return;
            }
        }

        if (rec.connectionPinState) {
            const pinState = String(rec.connectionPinState.pinState || 'none');
            await this.onMessage(session.deviceId, { pinState: rec.connectionPinState });
            if (pinState === 'required') {
                await this.setSessionState(session, 'pin-required', true);
                if (this.config.pairingPin) {
                    this.sendFrame(session, encodeControlFrame(makePinInput(this.config.pairingPin)));
                }
                return;
            }
            if (pinState === 'optional' && this.config.pairingPin && rec.connectionPinState.inputPermission === 'ok') {
                this.sendFrame(session, encodeControlFrame(makePinInput(this.config.pairingPin)));
                return;
            }
            if (pinState === 'pinOk' || pinState === 'none' || pinState === 'optional') {
                await this.enterDataExchange(session);
                return;
            }
        }

        if (rec.connectionPinInput) {
            const pin = String(rec.connectionPinInput.pin || '');
            if (!this.config.pairingPin || pin === this.config.pairingPin) {
                this.sendFrame(session, encodeControlFrame(makePinState('pinOk')));
                await this.enterDataExchange(session);
            } else {
                this.sendFrame(session, encodeControlFrame(makePinError(1)));
            }
            return;
        }

        if (rec.connectionPinError) {
            await this.setSessionState(session, 'error', true, `Remote PIN error ${JSON.stringify(rec.connectionPinError)}`);
            return;
        }

        await this.onMessage(session.deviceId, { unhandledControl: rec });
    }

    private async sendHelloForTrust(session: ShipSession): Promise<void> {
        const trusted = this.config.autoAcceptNewDevices || (await this.isTrusted(session.deviceId));
        if (trusted) {
            session.localHelloReady = true;
            this.sendFrame(session, encodeControlFrame(makeHello('ready')));
            await this.setSessionState(session, 'hello-ready', true);
            if (session.remoteHelloReady) await this.startProtocolHandshake(session);
        } else {
            this.sendFrame(session, encodeControlFrame(makeHello('pending', 120000)));
            await this.setSessionState(session, 'hello-pending', true);
            await this.onPairingRequest(session.deviceId, {
                deviceId: session.deviceId,
                remoteSki: session.remoteSki,
                remoteFingerprint: session.remoteFingerprint,
                message: 'Set devices.<id>.pairing.trusted=true or press approve to continue SHIP hello.',
            });
        }
    }

    private async startProtocolHandshake(session: ShipSession): Promise<void> {
        if (session.protocolSelected) return;
        if (session.role === 'client') {
            this.sendFrame(session, encodeControlFrame(makeProtocolHandshake('announceMax')));
        }
        // The server waits for the client's announceMax according to the SHIP protocol.
    }

    private async protocolHandshakeOk(session: ShipSession): Promise<void> {
        session.protocolSelected = true;
        await this.setSessionState(session, 'protocol-handshake-ok', true);
        this.sendFrame(session, encodeControlFrame(makePinState(this.config.pairingPin ? 'optional' : 'none', this.config.pairingPin ? 'ok' : undefined)));
        if (!this.config.pairingPin) await this.enterDataExchange(session);
    }

    private async enterDataExchange(session: ShipSession): Promise<void> {
        if (session.dataExchangeReady) return;
        session.dataExchangeReady = true;
        await this.setSessionState(session, 'data-exchange', true);
        await this.onDataExchange(session.deviceId);
    }

    private async setSessionState(session: ShipSession, state: ShipConnectionState, connected: boolean, error = ''): Promise<void> {
        session.state = state;
        await this.onState(session.deviceId, state, session.role, connected, error);
    }

    private sendFrame(session: ShipSession, frame: any): void {
        if (!this.isSocketOpen(session.socket)) return;
        session.socket.send(frame);
    }

    private isSocketOpen(socket: any): boolean {
        return socket && socket.readyState === 1;
    }

    private publishMdnsIfEnabled(port: number): void {
        if (!this.config.announceShipService) {
            this.adapter.log.warn('Local EOS/HEMS SHIP mDNS announcement is disabled. Remote EEBUS wallboxes cannot discover EOS automatically.');
            return;
        }

        try {
            const { Bonjour } = require('bonjour-service');
            this.bonjour = new Bonjour();
            this.advertisement = this.bonjour.publish({
                name: this.config.serviceName,
                type: 'ship',
                protocol: 'tcp',
                port,
                txt: {
                    txtvers: '1',
                    id: this.identity.shipId,
                    path: this.config.shipPath,
                    ski: this.identity.localSki,
                    register: 'true',
                    ecc: 'false',
                    brand: this.config.brand,
                    type: this.config.deviceType,
                    model: this.config.model,
                    serial: this.identity.shipId.slice(-32),
                    cat: this.config.deviceCategories.join(','),
                },
            });

            this.adapter.log.info(
                `Local EOS/HEMS SHIP service announced as "${this.config.serviceName}" via _ship._tcp ` +
                    `(brand=${this.config.brand}, model=${this.config.model}, type=${this.config.deviceType}, ski=${this.identity.localSki}).`,
            );
        } catch (error) {
            this.adapter.log.warn(`Could not announce local EOS/HEMS SHIP service via mDNS: ${String(error)}`);
        }
    }
}

function getPeerIdentity(request: any): { ski: string; fingerprint: string; remoteAddress: string } {
    const remoteAddress = String(request?.socket?.remoteAddress || 'unknown-remote').replace(/^::ffff:/, '');
    try {
        const cert = request.socket.getPeerCertificate?.(true);
        const raw = cert?.raw;
        const fingerprint = String(cert?.fingerprint256 || cert?.fingerprint || '')
            .replace(/:/g, '')
            .toUpperCase();
        if (raw) {
            const x509 = new X509Certificate(raw);
            const publicKeyDer = x509.publicKey.export({ type: 'spki', format: 'der' });
            const ski = createHash('sha1').update(publicKeyDer).digest('hex').toUpperCase();
            return { ski, fingerprint: fingerprint || String(x509.fingerprint256 || '').replace(/:/g, '').toUpperCase(), remoteAddress };
        }
        return { ski: '', fingerprint, remoteAddress };
    } catch {
        return { ski: '', fingerprint: '', remoteAddress };
    }
}

function addressForUrl(host: string): string {
    return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}
