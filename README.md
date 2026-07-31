# ioBroker.eebus

NexoWatt EEBUS Adapter for ioBroker.

This adapter exposes **NexoWatt EOS** as a local EEBUS **Energy Management System / HEMS** and prepares SHIP/SPINE communication with energy devices such as wallboxes, CLS/control boxes, smart meters, grid connection points, PV inverters, batteries, heat pumps and HVAC/climate devices.

> Status: field-test core. Version `0.2.0` contains SHIP session handling, pairing/trust states, SPINE NodeManagement discovery, use-case detection and field-test command mappings. It still needs validation with real EEBUS devices before production or certification-level use.

## Documentation basis

The implementation was prepared from the EEBUS documentation package supplied to the project, especially:

- EEBus SHIP Technical Specification v1.1.0
- EEBus SHIP Pairing Service Technical Specification v1.0.0
- EEBus SPINE v1.3.0
- EEBus SHIP Requirements for Installation Process v1.1.0
- Use cases for EV charging, battery control, grid connection point monitoring, inverter monitoring, HVAC / heat pumps, power limitation and PV/battery visualization

Public project information is available from the EEBUS Initiative: <https://www.eebus.org/>

## What is implemented in 0.2.0

### NexoWatt EOS as HEMS

The adapter announces the local SHIP service as:

```text
NexoWatt EOS._ship._tcp.local
TXT type=EnergyManagementSystem
TXT brand=NexoWatt
TXT model=EOS
TXT register=true
```

This is required so EEBUS wallboxes can show NexoWatt EOS in their HEMS pairing list.

### Local EEBUS identity

The adapter generates and persists a local EEBUS/SHIP identity on first start:

- secp256r1 private key via OpenSSL
- self-signed X.509 certificate
- local SKI
- stable SHIP ID
- SHA-256 certificate fingerprint

The SKI, SHIP ID and fingerprint are exposed under `identity.*`.

### SHIP field-test session handling

The adapter now contains a first SHIP state machine for field tests:

- TLS/WebSocket endpoint using protocol `ship`
- outgoing client connection to discovered SHIP devices
- CMI frame exchange
- Hello pending/ready handling
- protocol handshake with SHIP `1.1` and `JSON-UTF8`
- optional PIN input handling
- data-exchange readiness state
- connection diagnostics per device

### Pairing / trust workflow

Each device gets:

```text
devices.<id>.pairing.trusted
devices.<id>.pairing.approve
devices.<id>.pairing.reject
devices.<id>.pairing.pairingState
devices.<id>.pairing.remoteSki
devices.<id>.pairing.remoteFingerprint
```

The default mode is conservative:

```text
autoAcceptNewDevices = false
allowCommandsToUntrustedDevices = false
commandDryRun = true
```

For controlled lab tests, `pairing.autoAcceptNewDevices` can be enabled. Do not use auto-accept for production.

### SPINE discovery and parser

After SHIP data exchange is ready, the adapter sends a read-only SPINE NodeManagement detailed discovery request. This request is sent even when `commandDryRun` is enabled because it is required to identify the device and its supported functions.

The adapter parses incoming SPINE payloads to extract:

- device types
- feature types
- supported functions
- use cases / specific usage where available
- basic measurements

### Device classes

The adapter can classify devices as:

```text
wallbox
clsBox
smartMeter
gridConnection
inverter
battery
heatPump
hvac
climate
unknown
```

This allows EOS to prepare the correct object model even before manufacturer-specific details are added.

## Object model

Base structure:

```text
eebus.0.identity.*
eebus.0.discovery.*
eebus.0.pairing.*
eebus.0.devices.<deviceId>.info.*
eebus.0.devices.<deviceId>.connection.*
eebus.0.devices.<deviceId>.measurements.*
eebus.0.devices.<deviceId>.control.*
eebus.0.devices.<deviceId>.limits.*
eebus.0.devices.<deviceId>.pairing.*
eebus.0.devices.<deviceId>.useCases.*
eebus.0.devices.<deviceId>.raw.*
```

Important connection states:

```text
devices.<id>.connection.shipState
devices.<id>.connection.connected
devices.<id>.connection.dataExchangeReady
devices.<id>.connection.lastError
```

Important use-case states:

```text
devices.<id>.useCases.detected
devices.<id>.useCases.features
devices.<id>.useCases.functions
devices.<id>.useCases.nodeManagement
devices.<id>.useCases.supportedDeviceClasses
```

Writable control/limit states include:

```text
control.enableCharging
control.maxChargingPower
control.maxChargingCurrent
control.targetTemperature
control.hvacMode
limits.activePowerLimit
limits.consumptionLimit
limits.productionLimit
limits.gridImportLimit
limits.gridExportLimit
limits.heatPumpPowerLimit
```

## Field-test workflow

1. Install the adapter.
2. Start the adapter and verify that `NexoWatt EOS` is visible via `_ship._tcp`.
3. Start EEBUS/HEMS pairing on the wallbox or another EEBUS device.
4. Watch `devices.<id>.pairing.pairingState`.
5. Approve the device with `devices.<id>.pairing.approve = true` or set `devices.<id>.pairing.trusted = true`.
6. Wait until `devices.<id>.connection.dataExchangeReady = true`.
7. Check `devices.<id>.useCases.*` and `devices.<id>.raw.lastSpineFrame`.
8. Keep `commandDryRun = true` until the SPINE command payloads have been verified with the real device.
9. Disable `commandDryRun` only for controlled tests after pairing and NodeManagement discovery work.

## Installation

After publication to the npm registry:

```bash
npm install iobroker.eebus
```

During development or controlled rollout, the repository can also be installed via HTTPS:

```bash
npm install git+https://github.com/NexoWatt/ioBroker.eebus.git
```

The package is published under a proprietary NexoWatt license. Public availability of the package does not grant third-party usage, copying, modification, redistribution or sublicensing rights.

## Quick network check

On the EOS system:

```bash
sudo apt install avahi-utils
avahi-browse -rt _ship._tcp
```

Expected service:

```text
NexoWatt EOS._ship._tcp.local
```

If the device cannot see EOS:

- EOS and the device must be in the same LAN/VLAN or mDNS must be relayed.
- UDP 5353 multicast must not be blocked.
- TCP port 4712 must be reachable from the EEBUS device.
- Guest Wi-Fi / client isolation must be disabled.

## Known limitations

- This version is not a certified EEBUS stack.
- Real device communication still needs validation with wallboxes, CLS/control boxes, smart meters, PV/battery devices and HVAC equipment.
- SPINE write mappings are field-test payloads and may need per-device feature addressing, limit IDs, selectors or bindings learned from NodeManagement discovery.
- Production use with grid operator equipment / CLS boxes requires additional verification, audit logs and certification-level testing.
- EEBUS devices differ in their supported use cases; EEBUS-compatible does not automatically mean every function is available.

## Development

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
