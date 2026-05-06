# Object model

The adapter uses the requested `device -> channel -> state` layout.

## Root states

```text
eebus.0.info.connection
eebus.0.identity.localSki
eebus.0.identity.shipId
eebus.0.identity.certificateFingerprint
eebus.0.discovery.enabled
eebus.0.discovery.discoveredCount
eebus.0.discovery.lastDiscovery
```

## Device channels

```text
eebus.0.devices.<deviceId>.info.*
eebus.0.devices.<deviceId>.measurements.*
eebus.0.devices.<deviceId>.control.*
eebus.0.devices.<deviceId>.limits.*
eebus.0.devices.<deviceId>.pairing.*
eebus.0.devices.<deviceId>.raw.*
```

## Ack rules

- Measured and discovered values are written with `ack: true`.
- User commands arrive with `ack: false`.
- Command drafts are written to `raw.lastCommand` with `ack: true`.
- Command states are only acknowledged after the adapter accepts or locally handles the command.
- Commands to untrusted devices are not sent by default.

## Device categories

The first version maps discovered nodes conservatively and keeps the original EEBUS category data in `raw.discovery`.

Expected target devices:

- wallbox
- inverter
- smart meter
- CLS box
- battery
- grid connection point
