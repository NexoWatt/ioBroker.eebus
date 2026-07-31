import { sanitizeServiceInstanceName, sanitizeTxtValue, toBoolean, toNumber } from './sanitizer';

export interface EebusConfig {
    discoveryEnabled: boolean;
    measurementIntervalSec: number;
    metadataIntervalSec: number;
    shipServerEnabled: boolean;
    announceShipService: boolean;
    shipPort: number;
    shipPath: string;
    serviceName: string;
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

const DEFAULT_BRAND = 'NexoWatt';
const DEFAULT_MODEL = 'EOS';
const DEFAULT_DEVICE_TYPE = 'EnergyManagementSystem';
const DEFAULT_SERVICE_NAME = 'NexoWatt EOS';

const LEGACY_MODELS = new Set([
    '',
    'ioBroker-EEBUS-Adapter',
    'ioBroker EEBUS Adapter',
    'ioBroker-EEBUS Adapter',
    'NexoWatt-ioBroker-EEBUS-Adapter',
    'NexoWatt ioBroker EEBUS Adapter',
    'NexoWatt EEBUS Adapter',
]);

export function getConfig(native: Record<string, unknown>): EebusConfig {
    const shipPath = normalizeShipPath(native.shipPath);
    const brand = sanitizeTxtValue(native.brand, DEFAULT_BRAND, 32);
    const model = normalizeModel(native.model);
    const deviceType = sanitizeTxtValue(native.deviceType, DEFAULT_DEVICE_TYPE, 32) || DEFAULT_DEVICE_TYPE;
    const serviceName = normalizeServiceName(native.serviceName, brand, model);

    return {
        discoveryEnabled: toBoolean(native.discoveryEnabled, true),
        measurementIntervalSec: Math.max(5, toNumber(native.measurementIntervalSec, 10)),
        metadataIntervalSec: Math.max(30, toNumber(native.metadataIntervalSec, 60)),
        shipServerEnabled: toBoolean(native.shipServerEnabled, true),
        // NexoWatt EOS is the HEMS. While it advertises as EnergyManagementSystem, mDNS announcement must stay active
        // so wallboxes can show it in their EEBUS/HEMS pairing list, even if an older native config contains false.
        announceShipService: deviceType === DEFAULT_DEVICE_TYPE ? true : toBoolean(native.announceShipService, true),
        shipPort: Math.min(65535, Math.max(1024, toNumber(native.shipPort, 4712))),
        shipPath,
        serviceName,
        brand,
        model,
        deviceType,
        deviceCategories: normalizeCategories(native.deviceCategories),
        ianaPen: sanitizeTxtValue(native.ianaPen, '999999', 16).replace(/[^0-9]/g, '').slice(0, 6) || '999999',
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

function normalizeShipPath(input: unknown): string {
    const raw = String(input || '/ship/').trim() || '/ship/';
    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.slice(0, 32) || '/ship/';
}

function normalizeModel(input: unknown): string {
    const raw = String(input ?? '').trim();
    if (LEGACY_MODELS.has(raw)) {
        return DEFAULT_MODEL;
    }

    return sanitizeTxtValue(raw || DEFAULT_MODEL, DEFAULT_MODEL, 32);
}

function normalizeServiceName(input: unknown, brand: string, model: string): string {
    const raw = String(input ?? '').trim();
    const candidate = raw && !LEGACY_MODELS.has(raw) ? raw : `${brand} ${model}`;
    return sanitizeServiceInstanceName(candidate, DEFAULT_SERVICE_NAME);
}

function normalizeCategories(input: unknown): string[] {
    const categories = String(input || '2')
        .split(',')
        .map(item => sanitizeTxtValue(item, '', 8))
        .filter(Boolean);

    return categories.length > 0 ? categories : ['2'];
}
