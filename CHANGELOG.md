# Changelog

## 0.1.0 (2026-05-06)

- Initial internal NexoWatt EEBUS adapter skeleton.
- Added local SHIP identity generation with persistent SHIP ID, certificate, private key and SKI.
- Added JSONConfig admin UI.
- Added EEBUS mDNS discovery skeleton for `_ship._tcp` and `_shippairing._tcp` services.
- Added optional local TLS/WebSocket SHIP endpoint skeleton.
- Added ioBroker object model for devices, measurements, controls, limits, pairing and raw diagnostics.
- Added command routing scaffold for charging enablement, charging limits, active power limits and setpoints.
- Added GitHub Actions, Dependabot and proprietary NexoWatt license.

### Known limitations

- Real device communication has not been validated with physical wallboxes, inverters, smart meters or CLS boxes.
- SPINE payloads are implemented as draft command envelopes and must be verified against real device traces.
- Pairing/trust workflow is intentionally conservative and still requires field testing.
