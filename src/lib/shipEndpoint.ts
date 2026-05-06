import { createServer } from 'node:https';
import { AddressInfo } from 'node:net';
import { EebusConfig } from './config';
import { EebusIdentity } from './eebusTypes';

type MessageCallback = (deviceId: string, message: unknown) => void | Promise<void>;

export class ShipEndpoint {
    private server: any;
    private wss: any;
    private bonjour: any;
    private advertisement: any;
    private sockets = new Map<string, any>();

    public constructor(
        private readonly adapter: any,
        private readonly config: EebusConfig,
        private readonly identity: EebusIdentity,
        private readonly onMessage: MessageCallback,
    ) {}

    public async start(): Promise<boolean> {
        if (!this.config.shipServerEnabled) {
            this.adapter.log.info('Local SHIP endpoint is disabled.');
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
                });

                this.wss = new WebSocketServer({ server: this.server, path: this.config.shipPath });

                this.wss.on('connection', (socket: any, request: any) => {
                    const remote = this.getRemoteId(request);
                    this.sockets.set(remote, socket);
                    this.adapter.log.info(`SHIP WebSocket connected from ${remote}`);

                    socket.on('message', (data: any) => {
                        const message = parseMessage(data);
                        void this.onMessage(remote, message);
                    });

                    socket.on('close', () => {
                        this.sockets.delete(remote);
                        this.adapter.log.info(`SHIP WebSocket disconnected from ${remote}`);
                    });

                    socket.on('error', (error: Error) => this.adapter.log.warn(`SHIP WebSocket error from ${remote}: ${error.message}`));
                });

                this.server.on('error', (error: Error) => {
                    this.adapter.log.warn(`Local SHIP endpoint could not listen on port ${this.config.shipPort}: ${error.message}`);
                    resolve(false);
                });

                this.server.listen(this.config.shipPort, () => {
                    const address = this.server.address() as AddressInfo;
                    this.adapter.log.info(`Local SHIP endpoint listening on port ${address.port}${this.config.shipPath}`);
                    this.publishMdnsIfEnabled(address.port);
                    resolve(true);
                });
            } catch (error) {
                this.adapter.log.warn(`Local SHIP endpoint could not start: ${String(error)}`);
                resolve(false);
            }
        });
    }

    public send(deviceId: string, payload: unknown): boolean {
        const socket = this.sockets.get(deviceId);

        if (!socket || socket.readyState !== 1) {
            return false;
        }

        socket.send(JSON.stringify(payload));
        return true;
    }

    public async stop(): Promise<void> {
        for (const socket of this.sockets.values()) {
            try {
                socket.close();
            } catch (error) {
                this.adapter.log.debug(`Could not close SHIP socket: ${String(error)}`);
            }
        }

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

    private publishMdnsIfEnabled(port: number): void {
        if (!this.config.announceShipService) {
            return;
        }

        try {
            const { Bonjour } = require('bonjour-service');
            this.bonjour = new Bonjour();
            this.advertisement = this.bonjour.publish({
                name: `${this.config.brand}-${this.config.model}`,
                type: 'ship',
                protocol: 'tcp',
                port,
                txt: {
                    txtvers: '1',
                    id: this.identity.shipId,
                    path: this.config.shipPath,
                    ski: this.identity.localSki,
                    register: 'true',
                    ecc: 'true',
                    brand: this.config.brand,
                    type: this.config.deviceType,
                    model: this.config.model,
                    serial: this.identity.shipId.slice(-32),
                    cat: this.config.deviceCategories.join(','),
                },
            });

            this.adapter.log.info('Local SHIP service is announced via mDNS.');
        } catch (error) {
            this.adapter.log.warn(`Could not announce local SHIP service via mDNS: ${String(error)}`);
        }
    }

    private getRemoteId(request: any): string {
        try {
            const cert = request.socket.getPeerCertificate?.();
            const fingerprint = String(cert?.fingerprint256 || cert?.fingerprint || '').replace(/:/g, '').toUpperCase();
            if (fingerprint) return fingerprint;
        } catch {
            // ignore and fall back to IP address
        }

        return String(request.socket.remoteAddress || 'unknown-remote');
    }
}

function parseMessage(data: any): unknown {
    try {
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
        return JSON.parse(text);
    } catch {
        return {
            type: 'raw',
            value: Buffer.isBuffer(data) ? data.toString('base64') : String(data),
        };
    }
}
