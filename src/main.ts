import * as utils from '@iobroker/adapter-core';
import { getConfig } from './lib/config';
import { EebusRuntime } from './lib/eebusRuntime';
import { IdentityManager } from './lib/identityManager';
import { ObjectFactory } from './lib/objectFactory';

class EebusAdapter extends utils.Adapter {
    private runtime?: EebusRuntime;

    public constructor(options: Partial<ioBroker.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'eebus',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        await this.setStateAsync('info.connection', { val: false, ack: true });

        const config = getConfig(this.config || {});
        const objectFactory = new ObjectFactory(this);
        await objectFactory.ensureBaseObjects();

        try {
            const identity = await new IdentityManager(this, config).ensureIdentity();
            await objectFactory.publishIdentity(identity, config);

            this.runtime = new EebusRuntime(this, config, identity, objectFactory);
            await this.runtime.start();

            this.subscribeStates('devices.*.control.*');
            this.subscribeStates('devices.*.limits.*');
            this.subscribeStates('devices.*.pairing.trusted');

            this.log.info('NexoWatt EEBUS adapter started.');
        } catch (error) {
            this.log.error(`NexoWatt EEBUS adapter could not start: ${String(error)}`);
            await this.setStateAsync('info.connection', { val: false, ack: true });
        }
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state) {
            return;
        }

        try {
            await this.runtime?.handleStateChange(id, state);
        } catch (error) {
            this.log.error(`Could not process state change ${id}: ${String(error)}`);
        }
    }

    private async onUnload(callback: () => void): Promise<void> {
        try {
            this.unsubscribeStates('devices.*.control.*');
            this.unsubscribeStates('devices.*.limits.*');
            this.unsubscribeStates('devices.*.pairing.trusted');

            await this.runtime?.stop();
            this.runtime = undefined;
            callback();
        } catch (error) {
            this.log.error(`Unload cleanup failed: ${String(error)}`);
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new EebusAdapter(options);
} else {
    (() => new EebusAdapter())();
}
