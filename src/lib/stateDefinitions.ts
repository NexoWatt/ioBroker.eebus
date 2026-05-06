export interface StateDefinition {
    id: string;
    name: string;
    channel: 'info' | 'measurements' | 'control' | 'limits' | 'raw' | 'pairing';
    type: 'boolean' | 'number' | 'string' | 'object';
    role: string;
    read: boolean;
    write: boolean;
    unit?: string;
    def?: unknown;
    desc?: string;
}

export const identityStates: StateDefinition[] = [
    { id: 'localSki', name: 'Local SKI', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'shipId', name: 'Local SHIP ID', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    {
        id: 'certificateFingerprint',
        name: 'Certificate fingerprint SHA-256',
        channel: 'info',
        type: 'string',
        role: 'info',
        read: true,
        write: false,
    },
];

export const discoveryStates: StateDefinition[] = [
    {
        id: 'enabled',
        name: 'Discovery enabled',
        channel: 'info',
        type: 'boolean',
        role: 'switch.enable',
        read: true,
        write: false,
        def: true,
    },
    {
        id: 'discoveredCount',
        name: 'Discovered devices count',
        channel: 'info',
        type: 'number',
        role: 'value',
        read: true,
        write: false,
        def: 0,
    },
    {
        id: 'lastDiscovery',
        name: 'Last discovery event',
        channel: 'info',
        type: 'string',
        role: 'json',
        read: true,
        write: false,
    },
];

export const deviceStates: StateDefinition[] = [
    { id: 'online', name: 'Online', channel: 'info', type: 'boolean', role: 'indicator.connected', read: true, write: false, def: false },
    { id: 'manufacturer', name: 'Manufacturer', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'model', name: 'Model', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'serialNumber', name: 'Serial number', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'ski', name: 'Remote SKI', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'deviceType', name: 'Device type', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'shipId', name: 'Remote SHIP ID', channel: 'info', type: 'string', role: 'info', read: true, write: false },

    { id: 'power', name: 'Power', channel: 'measurements', type: 'number', role: 'value.power', read: true, write: false, unit: 'W' },
    { id: 'energy', name: 'Energy', channel: 'measurements', type: 'number', role: 'value.energy', read: true, write: false, unit: 'Wh' },
    { id: 'voltage', name: 'Voltage', channel: 'measurements', type: 'number', role: 'value.voltage', read: true, write: false, unit: 'V' },
    { id: 'current', name: 'Current', channel: 'measurements', type: 'number', role: 'value.current', read: true, write: false, unit: 'A' },
    { id: 'frequency', name: 'Frequency', channel: 'measurements', type: 'number', role: 'value.frequency', read: true, write: false, unit: 'Hz' },
    { id: 'soc', name: 'State of charge', channel: 'measurements', type: 'number', role: 'value.battery', read: true, write: false, unit: '%' },
    { id: 'chargingState', name: 'Charging state', channel: 'measurements', type: 'string', role: 'state', read: true, write: false },

    { id: 'enableCharging', name: 'Enable charging', channel: 'control', type: 'boolean', role: 'switch.enable', read: true, write: true, def: false },
    { id: 'maxChargingPower', name: 'Maximum charging power', channel: 'control', type: 'number', role: 'level.power', read: true, write: true, unit: 'W' },
    { id: 'maxChargingCurrent', name: 'Maximum charging current', channel: 'control', type: 'number', role: 'level.current', read: true, write: true, unit: 'A' },
    { id: 'activePowerLimit', name: 'Active power limit', channel: 'limits', type: 'number', role: 'level.power', read: true, write: true, unit: 'W' },
    { id: 'setpointPower', name: 'Setpoint power', channel: 'limits', type: 'number', role: 'level.power', read: true, write: true, unit: 'W' },

    { id: 'trusted', name: 'Trusted', channel: 'pairing', type: 'boolean', role: 'switch.enable', read: true, write: true, def: false },
    { id: 'pairingState', name: 'Pairing state', channel: 'pairing', type: 'string', role: 'state', read: true, write: false, def: 'discovered' },
    { id: 'remoteSki', name: 'Pairing remote SKI', channel: 'pairing', type: 'string', role: 'info', read: true, write: false },
    { id: 'remoteShipId', name: 'Pairing remote SHIP ID', channel: 'pairing', type: 'string', role: 'info', read: true, write: false },

    { id: 'discovery', name: 'Raw discovery data', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastMessage', name: 'Last raw message', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastCommand', name: 'Last command draft', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastError', name: 'Last error', channel: 'raw', type: 'string', role: 'text', read: true, write: false },
];

export const channelNames: Record<StateDefinition['channel'], string> = {
    info: 'Information',
    measurements: 'Measurements',
    control: 'Control',
    limits: 'Limits',
    raw: 'Raw diagnostics',
    pairing: 'Pairing',
};
