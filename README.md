# ioBroker.eebus

NexoWatt EEBUS Adapter for ioBroker.

This adapter is a NexoWatt EEBUS adapter prototype for local EEBUS SHIP/SPINE communication with energy devices such as wallboxes, inverters, smart meters, CLS boxes, batteries and grid connection points. It is prepared for publication as the npm package `iobroker.eebus` and for HTTPS-based installation from the GitHub repository.

> Status: initial implementation scaffold. It is designed to be field-tested with real devices before production use.

## Documentation basis

The first implementation was prepared from the EEBUS documentation package supplied to the project, especially:

- EEBus SHIP Technical Specification v1.1.0
- EEBus SHIP Pairing Service Technical Specification v1.0.0
- EEBus SPINE v1.3.0
- EEBus SHIP Requirements for Installation Process v1.1.0
- Use cases for EV charging, battery control, grid connection point monitoring, inverter monitoring, power limitation and PV/battery visualization

Public project information is available from the EEBUS Initiative: <https://www.eebus.org/>

## Features

Implemented in this first repository version:

- ioBroker TypeScript adapter structure
- JSONConfig admin UI
- local SHIP identity generation:
  - secp256r1 private key via OpenSSL
  - self-signed X.509 certificate
  - stable SHIP ID
  - local SKI
  - SHA-256 certificate fingerprint
- protected/encrypted native handling for private key and pairing PIN
- mDNS browsing for EEBUS `_ship._tcp` and `_shippairing._tcp`
- optional local TLS/WebSocket SHIP endpoint skeleton
- device object model:
  - `devices.<deviceId>.info.*`
  - `devices.<deviceId>.measurements.*`
  - `devices.<deviceId>.control.*`
  - `devices.<deviceId>.limits.*`
  - `devices.<deviceId>.pairing.*`
  - `devices.<deviceId>.raw.*`
- command routing scaffold for:
  - `enableCharging`
  - `maxChargingPower`
  - `maxChargingCurrent`
  - `activePowerLimit`
  - `setpointPower`
- conservative command behavior:
  - commands are not sent to untrusted devices by default
  - command dry-run is enabled by default
  - draft SPINE command envelopes are written to `raw.lastCommand`

## Object model

### Identity

| State | Type | Role | Description |
| --- | --- | --- | --- |
| `identity.localSki` | string | `info` | Local EEBUS SKI |
| `identity.shipId` | string | `info` | Local SHIP ID |
| `identity.certificateFingerprint` | string | `info` | Local certificate fingerprint |

### Discovery

| State | Type | Role | Description |
| --- | --- | --- | --- |
| `discovery.enabled` | boolean | `switch.enable` | Discovery configuration state |
| `discovery.discoveredCount` | number | `value` | Number of currently known discovered nodes |
| `discovery.lastDiscovery` | string | `json` | Last raw discovery event |

### Device states

Each discovered device gets this structure:

```text
devices.<deviceId>.info.*
devices.<deviceId>.measurements.*
devices.<deviceId>.control.*
devices.<deviceId>.limits.*
devices.<deviceId>.pairing.*
devices.<deviceId>.raw.*
```

Read-only measurement and information states:

```text
online
manufacturer
model
serialNumber
ski
deviceType
shipId
power
energy
voltage
current
frequency
soc
chargingState
```

Writable control and limit states:

```text
enableCharging
maxChargingPower
maxChargingCurrent
activePowerLimit
setpointPower
pairing.trusted
```

## Installation

After publication to the npm registry:

```bash
npm install iobroker.eebus
```

For ioBroker systems, install the adapter through the ioBroker admin interface or CLI once the package is available. During development or controlled rollout, the repository can also be installed via HTTPS:

```bash
npm install git+https://github.com/NexoWatt/ioBroker.eebus.git
```

The package is published under a proprietary NexoWatt license. Public availability of the package does not grant third-party usage, copying, modification, redistribution or sublicensing rights.

## Configuration

Default configuration:

| Setting | Default | Meaning |
| --- | ---: | --- |
| `discoveryEnabled` | `true` | Browse for local EEBUS SHIP services |
| `measurementIntervalSec` | `10` | Measurement refresh interval |
| `metadataIntervalSec` | `60` | Metadata refresh interval |
| `shipServerEnabled` | `true` | Start local TLS/WebSocket SHIP endpoint |
| `announceShipService` | `false` | Announce local SHIP service via mDNS |
| `shipPort` | `4712` | Local SHIP endpoint port |
| `shipPath` | `/ship/` | WebSocket path |
| `commandDryRun` | `true` | Record draft command payloads without sending |
| `allowCommandsToUntrustedDevices` | `false` | Prevent accidental commands to untrusted devices |

### IANA PEN

The default `ianaPen` value is a placeholder (`999999`). Replace it with the real NexoWatt IANA PEN before production use if an official PEN is available.

## Runtime notes

The adapter uses `info.connection` to indicate that the local EEBUS networking subsystem is active. It does not mean that a specific remote device has already completed SHIP/SPINE pairing.

Device-level availability is exposed via:

```text
devices.<deviceId>.info.online
```

## Pairing and trust

This version contains a conservative trust model:

1. Devices are discovered through mDNS.
2. The remote SHIP ID and SKI are stored under `devices.<deviceId>.pairing.*`.
3. The user or a later pairing workflow must set `devices.<deviceId>.pairing.trusted` to `true`.
4. Commands are blocked unless the device is trusted or the advanced option `allowCommandsToUntrustedDevices` is enabled.

This is not yet a fully certified EEBUS pairing implementation.

## Known limitations

This initial version is intentionally honest about what has and has not been verified:

- Real device communication has not been tested because no real EEBUS logs or payloads were available during implementation.
- The SHIP endpoint is a TLS/WebSocket skeleton and still needs validation with physical EEBUS devices.
- SPINE command payloads are draft mappings and must be verified against target device traces.
- Discovery uses mDNS service data and does not guarantee successful SHIP pairing.
- Production use with CLS boxes and grid operator equipment requires additional certification-level testing.

## Development

Recommended development flow:

```bash
npm install
npm run build
npm test
```

The adapter requires Node.js 20 or newer.

## License

NexoWatt Proprietary License.

Copyright © 2026 NexoWatt. All rights reserved.

This software may only be used by NexoWatt or by parties explicitly authorized in writing by NexoWatt. Public npm/GitHub availability does not make this adapter open source. See [LICENSE](LICENSE).
