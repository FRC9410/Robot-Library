package frc.powerlib.configs;

import java.util.List;

/**
 * Relative-position settings. Slow motion is selected for decreasing positions.
 *
 * @param slowThreshold legacy parameter retained for generated JSON/source compatibility;
 *     it does not select the motion profile
 */
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
    double stopVoltage) {
  public RelativePositionSubsystemConfig {
    motorConfigs = ConfigValidation.motors(motorConfigs);
    java.util.Objects.requireNonNull(leadConfig, "leadConfig");
    java.util.Objects.requireNonNull(motionMagicConfig, "motionMagicConfig");
    java.util.Objects.requireNonNull(slowMotionMagicConfig, "slowMotionMagicConfig");
    ConfigValidation.subsystemName(subsystemName);
    ConfigValidation.text(units, "units");
    ConfigValidation.finite(forwardSoftLimit, "forwardSoftLimit");
    ConfigValidation.finite(reverseSoftLimit, "reverseSoftLimit");
    if (reverseSoftLimit > forwardSoftLimit) {
      throw new IllegalArgumentException("reverseSoftLimit must not exceed forwardSoftLimit");
    }
    ConfigValidation.range(homePosition, reverseSoftLimit, forwardSoftLimit, "homePosition");
    ConfigValidation.finite(slowThreshold, "slowThreshold");
    ConfigValidation.positive(tolerance, "tolerance");
    ConfigValidation.finite(stopVoltage, "stopVoltage");
  }

  /** @deprecated Unused legacy setting; the direction of travel selects the profile. */
  @Deprecated
  public double slowThreshold() {
    return slowThreshold;
  }
}
