# Changelog

## 0.2.1 (2026-07-31)

- Enabled JSONConfig internationalization with top-level `i18n: true` so the adapter admin settings follow the ioBroker admin/system language.
- Added complete German translations for all JSONConfig labels and help texts.
- Added Weblate-friendly translation files under `admin/i18n/de/translations.json` and `admin/i18n/en/translations.json` while keeping legacy `de.json`/`en.json` files for compatibility.

## 0.2.0 (2026-07-30)

- Added field-test SHIP session handling:
  - CMI frame exchange
  - Hello pending/ready handling
  - protocol handshake with JSON-UTF8
  - PIN state/input handling
  - SHIP data-exchange state tracking
- Added outgoing SHIP client connections to discovered `_ship._tcp` devices.
- Added incoming SHIP pairing state exposure for wallboxes that actively connect to NexoWatt EOS.
- Added pairing/trust workflow states, including per-device approve/reject buttons and global field-test auto-accept.
- Added SPINE data wrapper support for `ee1.0` payloads.
- Added SPINE NodeManagement detailed discovery read request after SHIP data exchange is ready.
- Added generic SPINE parser for feature/use-case extraction and basic measurement mapping.
- Added device-class detection for wallbox, CLS/control box, smart meter, grid connection, inverter, battery, heat pump, HVAC and climate devices.
- Added field-test command datagram generation for LoadControl, power limits, setpoint power and HVAC setpoints.
- Extended object model with `connection.*`, `useCases.*`, additional `measurements.*`, and richer `pairing.*` diagnostics.
- Kept write commands in dry-run mode by default; read-only NodeManagement discovery is sent when a SHIP data-exchange session exists.

## 0.1.2 (2026-07-30)

- Announce NexoWatt EOS as visible local HEMS / EnergyManagementSystem via mDNS.
- Enforce mDNS announcement in EnergyManagementSystem mode even when older native config contains `announceShipService=false`.
- Improve WebSocket setup for SHIP field tests.

## 0.1.1 (2026-07-30)

- Enable local SHIP mDNS announcement by default.
- Correct TXT `ecc=false` for the current secp256r1-only identity.

## 0.1.0 (2026-07-30)

- Initial NexoWatt EEBUS adapter scaffold.
