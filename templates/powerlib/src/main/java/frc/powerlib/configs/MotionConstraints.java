package frc.powerlib.configs;

/** Limits on autonomous chassis-speed requests, in meters, radians, and seconds. */
public record MotionConstraints(
    double maxVelocityMetersPerSecond,
    double maxAccelerationMetersPerSecondSquared,
    double maxAngularVelocityRadiansPerSecond,
    double maxAngularAccelerationRadiansPerSecondSquared) {
  public MotionConstraints {
    ConfigValidation.positive(maxVelocityMetersPerSecond, "maxVelocityMetersPerSecond");
    ConfigValidation.positive(maxAccelerationMetersPerSecondSquared, "maxAccelerationMetersPerSecondSquared");
    ConfigValidation.positive(maxAngularVelocityRadiansPerSecond, "maxAngularVelocityRadiansPerSecond");
    ConfigValidation.positive(maxAngularAccelerationRadiansPerSecondSquared,
        "maxAngularAccelerationRadiansPerSecondSquared");
  }
}
