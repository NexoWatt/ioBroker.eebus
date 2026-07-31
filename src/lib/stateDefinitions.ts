export type DeviceChannel = 'info' | 'connection' | 'measurements' | 'control' | 'limits' | 'raw' | 'pairing' | 'useCases';

export interface StateDefinition {
    id: string;
    name: string;
    channel?: DeviceChannel;
    type: 'boolean' | 'number' | 'string' | 'object';
    role: string;
    read: boolean;
    write: boolean;
    unit?: string;
    def?: unknown;
    desc?: string;
}

export const identityStates: StateDefinition[] = [
    { id: 'serviceName', name: 'Local SHIP service name', type: 'string', role: 'info.name', read: true, write: false },
    { id: 'deviceType', name: 'Local EEBUS device type', type: 'string', role: 'info', read: true, write: false },
    { id: 'announcementActive', name: 'Local HEMS announcement active', type: 'boolean', role: 'indicator', read: true, write: false, def: false },
    { id: 'localSki', name: 'Local SKI', type: 'string', role: 'info', read: true, write: false },
    { id: 'shipId', name: 'Local SHIP ID', type: 'string', role: 'info', read: true, write: false },
    {
        id: 'certificateFingerprint',
        name: 'Certificate fingerprint SHA-256',
        type: 'string',
        role: 'info',
        read: true,
        write: false,
    },
];

export const discoveryStates: StateDefinition[] = [
    { id: 'enabled', name: 'Discovery enabled', type: 'boolean', role: 'switch.enable', read: true, write: false, def: true },
    { id: 'discoveredCount', name: 'Discovered devices count', type: 'number', role: 'value', read: true, write: false, def: 0 },
    { id: 'lastDiscovery', name: 'Last discovery event', type: 'string', role: 'json', read: true, write: false },
];

export const globalPairingStates: StateDefinition[] = [
    {
        id: 'autoAcceptNewDevices',
        name: 'Auto accept new devices for field testing',
        type: 'boolean',
        role: 'switch.enable',
        read: true,
        write: true,
        def: false,
        desc: 'Field-test helper. When enabled, new SHIP peers are trusted automatically. Disable for production.',
    },
    { id: 'pendingCount', name: 'Pending pairing count', type: 'number', role: 'value', read: true, write: false, def: 0 },
    { id: 'trustedCount', name: 'Trusted devices count', type: 'number', role: 'value', read: true, write: false, def: 0 },
    { id: 'lastPairingRequest', name: 'Last pairing request', type: 'string', role: 'json', read: true, write: false },
];

export const deviceStates: StateDefinition[] = [
    { id: 'online', name: 'Online', channel: 'info', type: 'boolean', role: 'indicator.connected', read: true, write: false, def: false },
    { id: 'manufacturer', name: 'Manufacturer', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'model', name: 'Model', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'serialNumber', name: 'Serial number', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'ski', name: 'Remote SKI', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'deviceType', name: 'Device type', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'deviceClass', name: 'Detected device class', channel: 'info', type: 'string', role: 'info', read: true, write: false, def: 'unknown' },
    { id: 'shipId', name: 'Remote SHIP ID', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'host', name: 'Host', channel: 'info', type: 'string', role: 'info.ip', read: true, write: false },
    { id: 'port', name: 'Port', channel: 'info', type: 'number', role: 'info.port', read: true, write: false },
    { id: 'path', name: 'SHIP path', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'serviceType', name: 'mDNS service type', channel: 'info', type: 'string', role: 'info', read: true, write: false },
    { id: 'lastSeen', name: 'Last seen', channel: 'info', type: 'string', role: 'date', read: true, write: false },

    { id: 'connected', name: 'SHIP socket connected', channel: 'connection', type: 'boolean', role: 'indicator.connected', read: true, write: false, def: false },
    { id: 'shipState', name: 'SHIP connection state', channel: 'connection', type: 'string', role: 'state', read: true, write: false, def: 'discovered' },
    { id: 'role', name: 'SHIP connection role', channel: 'connection', type: 'string', role: 'info', read: true, write: false },
    { id: 'dataExchangeReady', name: 'SHIP data exchange ready', channel: 'connection', type: 'boolean', role: 'indicator', read: true, write: false, def: false },
    { id: 'lastConnected', name: 'Last connected', channel: 'connection', type: 'string', role: 'date', read: true, write: false },
    { id: 'lastDisconnected', name: 'Last disconnected', channel: 'connection', type: 'string', role: 'date', read: true, write: false },
    { id: 'lastError', name: 'Last connection error', channel: 'connection', type: 'string', role: 'text', read: true, write: false },

    { id: 'power', name: 'Power', channel: 'measurements', type: 'number', role: 'value.power', read: true, write: false, unit: 'W' },
    { id: 'energy', name: 'Energy', channel: 'measurements', type: 'number', role: 'value.energy', read: true, write: false, unit: 'Wh' },
    { id: 'voltage', name: 'Voltage', channel: 'measurements', type: 'number', role: 'value.voltage', read: true, write: false, unit: 'V' },
    { id: 'current', name: 'Current', channel: 'measurements', type: 'number', role: 'value.current', read: true, write: false, unit: 'A' },
    { id: 'frequency', name: 'Frequency', channel: 'measurements', type: 'number', role: 'value.frequency', read: true, write: false, unit: 'Hz' },
    { id: 'soc', name: 'State of charge', channel: 'measurements', type: 'number', role: 'value.battery', read: true, write: false, unit: '%' },
    { id: 'chargingState', name: 'Charging state', channel: 'measurements', type: 'string', role: 'state', read: true, write: false },
    { id: 'gridPower', name: 'Grid power', channel: 'measurements', type: 'number', role: 'value.power', read: true, write: false, unit: 'W' },
    { id: 'importPower', name: 'Import power', channel: 'measurements', type: 'number', role: 'value.power.consumption', read: true, write: false, unit: 'W' },
    { id: 'exportPower', name: 'Export power', channel: 'measurements', type: 'number', role: 'value.power.production', read: true, write: false, unit: 'W' },
    { id: 'pvPower', name: 'PV power', channel: 'measurements', type: 'number', role: 'value.power.production', read: true, write: false, unit: 'W' },
    { id: 'batteryPower', name: 'Battery power', channel: 'measurements', type: 'number', role: 'value.power', read: true, write: false, unit: 'W' },
    { id: 'temperature', name: 'Temperature', channel: 'measurements', type: 'number', role: 'value.temperature', read: true, write: false, unit: '°C' },
    { id: 'operatingState', name: 'Operating state', channel: 'measurements', type: 'string', role: 'state', read: true, write: false },

    { id: 'enableCharging', name: 'Enable charging', channel: 'control', type: 'boolean', role: 'switch.enable', read: true, write: true, def: false },
    { id: 'maxChargingPower', name: 'Maximum charging power', channel: 'control', type: 'number', role: 'level.power', read: true, write: true, unit: 'W' },
    { id: 'maxChargingCurrent', name: 'Maximum charging current', channel: 'control', type: 'number', role: 'level.current', read: true, write: true, unit: 'A' },
    { id: 'targetTemperature', name: 'Target temperature', channel: 'control', type: 'number', role: 'level.temperature', read: true, write: true, unit: '°C' },
    { id: 'hvacMode', name: 'HVAC mode', channel: 'control', type: 'string', role: 'state', read: true, write: true },
    { id: 'connect', name: 'Connect SHIP session', channel: 'control', type: 'boolean', role: 'button', read: true, write: true, def: false },
    { id: 'disconnect', name: 'Disconnect SHIP session', channel: 'control', type: 'boolean', role: 'button', read: true, write: true, def: false },
    { id: 'refreshNodeManagement', name: 'Refresh SPINE node management', channel: 'control', type: 'boolean', role: 'button', read: true, write: true, def: false },

    { id: 'activePowerLimit', name: 'Active power limit', channel: 'limits', type: 'number', role: 'level.power', read: true, write: true, unit: 'W' },
    { id: 'setpointPower', name: 'Setpoint power', channel: 'limits', type: 'number', role: 'level.power', read: true, write: true, unit: 'W' },
    { id: 'consumptionLimit', name: 'Consumption power limit', channel: 'limits', type: 'number', role: 'level.power.consumption', read: true, write: true, unit: 'W' },
    { id: 'productionLimit', name: 'Production power limit', channel: 'limits', type: 'number', role: 'level.power.production', read: true, write: true, unit: 'W' },
    { id: 'gridImportLimit', name: 'Grid import limit', channel: 'limits', type: 'number', role: 'level.power.consumption', read: true, write: true, unit: 'W' },
    { id: 'gridExportLimit', name: 'Grid export limit', channel: 'limits', type: 'number', role: 'level.power.production', read: true, write: true, unit: 'W' },
    { id: 'heatPumpPowerLimit', name: 'Heat pump power limit', channel: 'limits', type: 'number', role: 'level.power.consumption', read: true, write: true, unit: 'W' },

    { id: 'trusted', name: 'Trusted', channel: 'pairing', type: 'boolean', role: 'switch.enable', read: true, write: true, def: false },
    { id: 'approve', name: 'Approve pairing', channel: 'pairing', type: 'boolean', role: 'button', read: true, write: true, def: false },
    { id: 'reject', name: 'Reject pairing', channel: 'pairing', type: 'boolean', role: 'button', read: true, write: true, def: false },
    { id: 'pairingState', name: 'Pairing state', channel: 'pairing', type: 'string', role: 'state', read: true, write: false, def: 'discovered' },
    { id: 'remoteSki', name: 'Pairing remote SKI', channel: 'pairing', type: 'string', role: 'info', read: true, write: false },
    { id: 'remoteShipId', name: 'Pairing remote SHIP ID', channel: 'pairing', type: 'string', role: 'info', read: true, write: false },
    { id: 'remoteFingerprint', name: 'Pairing remote certificate fingerprint', channel: 'pairing', type: 'string', role: 'info', read: true, write: false },
    { id: 'trustLevel', name: 'Local trust level', channel: 'pairing', type: 'number', role: 'value', read: true, write: false, def: 0 },
    { id: 'verificationMode', name: 'Verification mode', channel: 'pairing', type: 'string', role: 'state', read: true, write: false },
    { id: 'pinState', name: 'Remote PIN state', channel: 'pairing', type: 'string', role: 'state', read: true, write: false },

    { id: 'detected', name: 'Detected EEBUS use cases', channel: 'useCases', type: 'string', role: 'json', read: true, write: false },
    { id: 'features', name: 'SPINE features', channel: 'useCases', type: 'string', role: 'json', read: true, write: false },
    { id: 'functions', name: 'SPINE functions', channel: 'useCases', type: 'string', role: 'json', read: true, write: false },
    { id: 'nodeManagement', name: 'SPINE node management discovery', channel: 'useCases', type: 'string', role: 'json', read: true, write: false },
    { id: 'primaryUseCase', name: 'Primary use case', channel: 'useCases', type: 'string', role: 'info', read: true, write: false },
    { id: 'supportedDeviceClasses', name: 'Supported device classes', channel: 'useCases', type: 'string', role: 'json', read: true, write: false },

    { id: 'discovery', name: 'Raw discovery data', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastMessage', name: 'Last raw message', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastShipFrame', name: 'Last SHIP frame', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastSpineFrame', name: 'Last SPINE frame', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastDataPayload', name: 'Last SHIP data payload', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastCommand', name: 'Last command draft', channel: 'raw', type: 'string', role: 'json', read: true, write: false },
    { id: 'lastError', name: 'Last error', channel: 'raw', type: 'string', role: 'text', read: true, write: false },
];

export const channelNames: Record<DeviceChannel, string> = {
    info: 'Information',
    connection: 'SHIP connection',
    measurements: 'Measurements',
    control: 'Control',
    limits: 'Limits',
    raw: 'Raw diagnostics',
    pairing: 'Pairing',
    useCases: 'Use cases',
};
