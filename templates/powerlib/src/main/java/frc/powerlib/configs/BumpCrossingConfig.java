package frc.powerlib.configs;

import java.util.Objects;

/** Crossing settings must be measured on the robot; all durations are seconds and angles degrees. */
public record BumpCrossingConfig(MotionConstraints motion, double speedMetersPerSecond,
    double tiltThresholdDegrees, double levelToleranceDegrees, double tiltDebounceSeconds,
    double levelSettleSeconds, double clearanceSeconds, double timeoutSeconds, double maxSignalAgeSeconds,
    double stoppedSpeedMetersPerSecond, double stoppedAngularSpeedRadiansPerSecond, boolean requireVisionRecovery) {
  public BumpCrossingConfig {
    Objects.requireNonNull(motion, "motion");
    ConfigValidation.positive(speedMetersPerSecond, "speedMetersPerSecond");
    if (speedMetersPerSecond > motion.maxVelocityMetersPerSecond()) {
      throw new IllegalArgumentException("Crossing speed exceeds motion limit");
    }
    ConfigValidation.range(tiltThresholdDegrees, 0, 90, "tiltThresholdDegrees");
    ConfigValidation.nonnegative(levelToleranceDegrees, "levelToleranceDegrees");
    if (levelToleranceDegrees >= tiltThresholdDegrees) {
      throw new IllegalArgumentException("Level tolerance must be below the tilt threshold");
    }
    ConfigValidation.positive(tiltDebounceSeconds, "tiltDebounceSeconds");
    ConfigValidation.positive(levelSettleSeconds, "levelSettleSeconds");
    ConfigValidation.positive(clearanceSeconds, "clearanceSeconds");
    ConfigValidation.positive(timeoutSeconds, "timeoutSeconds");
    ConfigValidation.positive(maxSignalAgeSeconds, "maxSignalAgeSeconds");
    ConfigValidation.positive(stoppedSpeedMetersPerSecond, "stoppedSpeedMetersPerSecond");
    ConfigValidation.positive(stoppedAngularSpeedRadiansPerSecond, "stoppedAngularSpeedRadiansPerSecond");
  }
}
