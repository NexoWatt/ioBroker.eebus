import { DeviceCommand, SpineDraftCommand } from './eebusTypes';

export function mapCommandToSpineDraft(command: DeviceCommand): SpineDraftCommand {
    const createdAt = new Date().toISOString();

    switch (command.stateName) {
        case 'enableCharging':
            return {
                protocol: 'SPINE',
                status: 'draft-unverified',
                deviceId: command.deviceId,
                featureType: 'LoadControl',
                function: 'loadControlLimitListData',
                command: 'write',
                payload: {
                    limitType: 'activePowerConsumptionLimit',
                    isEnabled: Boolean(command.value),
                    sourceState: `${command.channel}.${command.stateName}`,
                },
                note: 'Draft mapping for EV charging enablement. Verify against real Coordinated EV Charging / LoadControl device traces.',
                createdAt,
            };

        case 'maxChargingPower':
            return {
                protocol: 'SPINE',
                status: 'draft-unverified',
                deviceId: command.deviceId,
                featureType: 'LoadControl',
                function: 'loadControlLimitListData',
                command: 'write',
                payload: {
                    limitType: 'activePowerConsumptionLimit',
                    value: Number(command.value),
                    unit: 'W',
                    sourceState: `${command.channel}.${command.stateName}`,
                },
                note: 'Draft mapping for maximum charging power. Verify limitId/addressing with target EVSE.',
                createdAt,
            };

        case 'maxChargingCurrent':
            return {
                protocol: 'SPINE',
                status: 'draft-unverified',
                deviceId: command.deviceId,
                featureType: 'LoadControl',
                function: 'loadControlLimitListData',
                command: 'write',
                payload: {
                    limitType: 'currentLimit',
                    value: Number(command.value),
                    unit: 'A',
                    sourceState: `${command.channel}.${command.stateName}`,
                },
                note: 'Draft mapping for EV charging current curtailment. Verify phases and limit scope with target EVSE.',
                createdAt,
            };

        case 'activePowerLimit':
            return {
                protocol: 'SPINE',
                status: 'draft-unverified',
                deviceId: command.deviceId,
                featureType: 'LoadControl',
                function: 'loadControlLimitListData',
                command: 'write',
                payload: {
                    limitType: 'activePowerLimit',
                    value: Number(command.value),
                    unit: 'W',
                    sourceState: `${command.channel}.${command.stateName}`,
                },
                note: 'Draft mapping for active power limitation. Direction depends on device role: consumption or production.',
                createdAt,
            };

        case 'setpointPower':
            return {
                protocol: 'SPINE',
                status: 'draft-unverified',
                deviceId: command.deviceId,
                featureType: 'PowerSequences',
                function: 'powerSequenceScheduleData',
                command: 'write',
                payload: {
                    setpointType: 'activePower',
                    value: Number(command.value),
                    unit: 'W',
                    sourceState: `${command.channel}.${command.stateName}`,
                },
                note: 'Draft mapping for power setpoints. Requires validation against the target use case and actor role.',
                createdAt,
            };

        case 'trusted':
            return {
                protocol: 'SPINE',
                status: 'draft-unverified',
                deviceId: command.deviceId,
                featureType: 'NodeManagement',
                function: 'bindingManagement',
                command: 'localOnly',
                payload: {
                    trusted: Boolean(command.value),
                    sourceState: `${command.channel}.${command.stateName}`,
                },
                note: 'Local trust flag only. This does not replace the final SHIP trust or pairing process.',
                createdAt,
            };

        default:
            return {
                protocol: 'SPINE',
                status: 'draft-unverified',
                deviceId: command.deviceId,
                featureType: 'Unknown',
                function: 'Unknown',
                command: 'write',
                payload: {
                    value: command.value,
                    sourceState: `${command.channel}.${command.stateName}`,
                },
                note: 'No explicit SPINE draft mapping exists for this state yet.',
                createdAt,
            };
    }
}
