package frc.powerlib.configs;

import java.util.List;

public record RelativePositionSubsystemConfig(
    List<MotorConfig> motorConfigs,
    LeadMotorConfig leadConfig,
    MotionMagicConfig motionMagicConfig,
    MotionMagicConfig slowMotionMagicConfig,
    String subsystemName,
    String units,
    double homePosition,
    double forwardSoftLimit,
    double reverseSoftLimit,
    double slowThreshold,
    double tolerance,
    double stopVoltage) {}
