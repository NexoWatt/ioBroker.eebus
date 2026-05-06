export type DeviceClass =
    | 'wallbox'
    | 'inverter'
    | 'smartMeter'
    | 'clsBox'
    | 'battery'
    | 'gridConnection'
    | 'unknown';

export interface EebusIdentity {
    certificate: string;
    privateKey: string;
    shipId: string;
    localSki: string;
    certificateFingerprint: string;
    createdAt: string;
}

export interface DiscoveredShipNode {
    id: string;
    safeId: string;
    name: string;
    host: string;
    port: number;
    path: string;
    ski: string;
    brand: string;
    type: string;
    model: string;
    serial: string;
    categories: string[];
    register: boolean;
    ecc: boolean;
    txt: Record<string, string>;
    serviceType: 'ship' | 'shippairing';
    lastSeen: string;
}

export interface DeviceCommand {
    deviceId: string;
    channel: 'control' | 'limits' | 'pairing';
    stateName: string;
    value: unknown;
    ts: string;
}

export interface SpineDraftCommand {
    protocol: 'SPINE';
    status: 'draft-unverified';
    deviceId: string;
    featureType: string;
    function: string;
    command: string;
    payload: Record<string, unknown>;
    note: string;
    createdAt: string;
}
