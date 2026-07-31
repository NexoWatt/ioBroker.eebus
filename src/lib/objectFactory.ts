import { EebusConfig } from './config';
import { DiscoveredShipNode, EebusIdentity } from './eebusTypes';
import { channelNames, deviceStates, discoveryStates, identityStates, StateDefinition } from './stateDefinitions';

export class ObjectFactory {
    public constructor(private readonly adapter: any) {}

    public async ensureBaseObjects(): Promise<void> {
        await this.ensureChannel('identity', 'Local EEBUS identity');
        for (const state of identityStates) {
            await this.ensureState(`identity.${state.id}`, state);
        }

        await this.ensureChannel('discovery', 'EEBUS discovery');
        for (const state of discoveryStates) {
            await this.ensureState(`discovery.${state.id}`, state);
        }
    }

    public async publishIdentity(identity: EebusIdentity, config: EebusConfig): Promise<void> {
        await this.adapter.setStateAsync('identity.serviceName', { val: config.serviceName, ack: true });
        await this.adapter.setStateAsync('identity.deviceType', { val: config.deviceType, ack: true });
        await this.adapter.setStateAsync('identity.announcementActive', { val: config.shipServerEnabled && config.announceShipService, ack: true });
        await this.adapter.setStateAsync('identity.localSki', { val: identity.localSki, ack: true });
        await this.adapter.setStateAsync('identity.shipId', { val: identity.shipId, ack: true });
        await this.adapter.setStateAsync('identity.certificateFingerprint', {
            val: identity.certificateFingerprint,
            ack: true,
        });
    }

    public async ensureDevice(node: DiscoveredShipNode): Promise<void> {
        await this.adapter.setObjectNotExistsAsync(`devices.${node.safeId}`, {
            type: 'device',
            common: {
                name: node.name || node.id || node.safeId,
            },
            native: {
                eebus: true,
                shipId: node.id,
                ski: node.ski,
                serviceType: node.serviceType,
            },
        });

        for (const channel of Object.keys(channelNames) as Array<keyof typeof channelNames>) {
            await this.ensureChannel(`devices.${node.safeId}.${channel}`, channelNames[channel]);
        }

        for (const state of deviceStates) {
            await this.ensureState(`devices.${node.safeId}.${state.channel}.${state.id}`, state);
        }
    }

    public async publishDiscovery(node: DiscoveredShipNode): Promise<void> {
        await this.ensureDevice(node);
        await this.adapter.setStateAsync(`devices.${node.safeId}.info.online`, { val: true, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.info.manufacturer`, { val: node.brand, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.info.model`, { val: node.model, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.info.serialNumber`, { val: node.serial, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.info.ski`, { val: node.ski, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.info.deviceType`, { val: node.type, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.info.shipId`, { val: node.id, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.pairing.remoteSki`, { val: node.ski, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.pairing.remoteShipId`, { val: node.id, ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.pairing.pairingState`, { val: 'discovered', ack: true });
        await this.adapter.setStateAsync(`devices.${node.safeId}.raw.discovery`, {
            val: JSON.stringify(node, null, 2),
            ack: true,
        });
    }

    public async markOffline(deviceId: string): Promise<void> {
        await this.adapter.setStateAsync(`devices.${deviceId}.info.online`, { val: false, ack: true });
    }

    private async ensureChannel(id: string, name: string): Promise<void> {
        await this.adapter.setObjectNotExistsAsync(id, {
            type: 'channel',
            common: { name },
            native: {},
        });
    }

    private async ensureState(id: string, def: StateDefinition): Promise<void> {
        await this.adapter.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: def.name,
                type: def.type,
                role: def.role,
                read: def.read,
                write: def.write,
                unit: def.unit,
                def: def.def,
                desc: def.desc,
            },
            native: {},
        });
    }
}
