# Implementation notes

## Creator note

The project is structured to follow the current ioBroker adapter creator output style. In the build environment used for the first ZIP, `npx @iobroker/create-adapter@latest` could not complete because the npm registry host was not resolvable. Therefore the repository was created manually in a creator-compatible structure.

## EEBUS identity

The adapter generates and persists these values on first start:

- certificate
- private key
- SHIP ID
- local SKI
- certificate fingerprint

The private key and pairing PIN are listed in `encryptedNative`. The certificate, private key and pairing PIN are listed in `protectedNative`.

## SHIP TXT data

`announceShipService` is enabled by default because external devices such as wallboxes need the EOS HEMS endpoint to be visible via `_ship._tcp` mDNS discovery.

When `announceShipService` is enabled, the local mDNS TXT record contains:

```text
txtvers
id
path
ski
register
ecc
brand
type
model
serial
cat
```

## Current protocol level

Implemented:

- local identity creation
- mDNS discovery
- TLS/WebSocket endpoint scaffold
- raw message capture
- command draft generation

Not yet complete:

- certified SHIP handshake state machine
- complete SPINE feature/entity addressing
- final device-specific command payloads
- tested CLS/grid operator workflow

## 0.1.2 HEMS visibility fix

NexoWatt EOS is the local Energy Management System. Therefore the adapter now announces the local SHIP service as a user-visible HEMS endpoint:

```text
NexoWatt EOS._ship._tcp.local
TXT type=EnergyManagementSystem
TXT brand=NexoWatt
TXT model=EOS
TXT register=true
```

The announcement is enforced while `deviceType` is `EnergyManagementSystem`, because older ioBroker native configurations can keep a stored `announceShipService=false` value after an update. Without the local `_ship._tcp` announcement, a wallbox can run its EEBUS/HEMS search but will not display NexoWatt EOS in the pairing list.
