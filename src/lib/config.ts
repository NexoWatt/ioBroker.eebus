import { sanitizeTxtValue, toBoolean, toNumber } from './sanitizer';

export interface EebusConfig {
    discoveryEnabled: boolean;
    measurementIntervalSec: number;
    metadataIntervalSec: number;
    shipServerEnabled: boolean;
    announceShipService: boolean;
    shipPort: number;
    shipPath: string;
    brand: string;
    model: string;
    deviceType: string;
    deviceCategories: string[];
    ianaPen: string;
    pairingPin: string;
    certificate: string;
    privateKey: string;
    shipId: string;
    localSki: string;
    certificateFingerprint: string;
    allowCommandsToUntrustedDevices: boolean;
    commandDryRun: boolean;
    debugRawMessages: boolean;
}

export function getConfig(native: Record<string, unknown>): EebusConfig {
    const shipPath = String(native.shipPath || '/ship/').startsWith('/')
        ? String(native.shipPath || '/ship/')
        : `/${String(native.shipPath)}`;

    return {
        discoveryEnabled: toBoolean(native.discoveryEnabled, true),
        measurementIntervalSec: Math.max(5, toNumber(native.measurementIntervalSec, 10)),
        metadataIntervalSec: Math.max(30, toNumber(native.metadataIntervalSec, 60)),
        shipServerEnabled: toBoolean(native.shipServerEnabled, true),
        announceShipService: toBoolean(native.announceShipService, false),
        shipPort: Math.min(65535, Math.max(1024, toNumber(native.shipPort, 4712))),
        shipPath,
        brand: sanitizeTxtValue(native.brand, 'NexoWatt'),
        model: sanitizeTxtValue(native.model, 'ioBroker-EEBUS-Adapter'),
        deviceType: sanitizeTxtValue(native.deviceType, 'EnergyManagementSystem'),
        deviceCategories: String(native.deviceCategories || '2')
            .split(',')
            .map(item => sanitizeTxtValue(item))
            .filter(Boolean),
        ianaPen: sanitizeTxtValue(native.ianaPen, '999999').replace(/[^0-9]/g, '').slice(0, 6) || '999999',
        pairingPin: String(native.pairingPin || ''),
        certificate: String(native.certificate || ''),
        privateKey: String(native.privateKey || ''),
        shipId: String(native.shipId || ''),
        localSki: String(native.localSki || ''),
        certificateFingerprint: String(native.certificateFingerprint || ''),
        allowCommandsToUntrustedDevices: toBoolean(native.allowCommandsToUntrustedDevices, false),
        commandDryRun: toBoolean(native.commandDryRun, true),
        debugRawMessages: toBoolean(native.debugRawMessages, false),
    };
}
