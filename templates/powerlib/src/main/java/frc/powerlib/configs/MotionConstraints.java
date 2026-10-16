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

  /** Braking-envelope ceiling for the remaining translation distance outside tolerance. */
  public double maxTranslationSpeedToStop(double distanceMeters) {
    return stoppingSpeed(distanceMeters, maxAccelerationMetersPerSecondSquared, maxVelocityMetersPerSecond);
  }

  /** Braking-envelope ceiling for the remaining heading error outside tolerance. */
  public double maxAngularSpeedToStop(double angleRadians) {
    return stoppingSpeed(angleRadians, maxAngularAccelerationRadiansPerSecondSquared,
        maxAngularVelocityRadiansPerSecond);
  }

  private static double stoppingSpeed(double distance, double deceleration, double maxSpeed) {
    ConfigValidation.nonnegative(distance, "distanceToStop");
    return distance == 0 ? 0 : Math.min(maxSpeed, Math.sqrt(2 * deceleration * distance));
  }
}
