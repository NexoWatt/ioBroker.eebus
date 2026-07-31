# Changelog

## 0.1.2

- Announce the local SHIP service with the visible service instance name `NexoWatt EOS`.
- Set the default EEBUS model to `EOS` and keep the default device type as `EnergyManagementSystem`.
- Enforce SHIP mDNS announcement while running in `EnergyManagementSystem` mode so old instances with `announceShipService=false` still become visible for wallbox pairing.
- Add identity states for `serviceName`, `deviceType` and `announcementActive`.
- Use the SHIP WebSocket subprotocol `ship` and disable WebSocket compression for the local endpoint scaffold.
- Preserve spaces in SHIP TXT values while respecting the SHIP TXT size limits.

## 0.1.1

- Enable local SHIP mDNS announcement by default so EEBUS wallboxes can discover EOS as HEMS.
- Add warning log when mDNS announcement is disabled.
- Correct SHIP TXT `ecc` value to `false` because the current identity generation only uses secp256r1.

## 0.1.0

- Initial NexoWatt EEBUS adapter scaffold.
- Added local SHIP identity generation, mDNS discovery, SHIP endpoint scaffold and ioBroker object model.
