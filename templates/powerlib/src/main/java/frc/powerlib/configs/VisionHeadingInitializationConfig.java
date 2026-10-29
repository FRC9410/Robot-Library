package frc.powerlib.configs;

/** Heading stability and stationary policy; enabled controls automatic initialization and hard resets. */
public record VisionHeadingInitializationConfig(
    boolean enabled,
    double minStableSeconds,
    int minFrames,
    double maxSpreadDegrees,
    double maxSpeedMetersPerSecond,
    double maxYawRateDegreesPerSecond,
    double maxSignalAgeSeconds) {
  public static final VisionHeadingInitializationConfig DEFAULT =
      new VisionHeadingInitializationConfig(true, 0.25, 5, 2, 0.05, 5, 0.5);

  public VisionHeadingInitializationConfig {
    ConfigValidation.positive(minStableSeconds, "minStableSeconds");
    if (minFrames < 2) throw new IllegalArgumentException("minFrames must be at least 2");
    ConfigValidation.positive(maxSpreadDegrees, "maxSpreadDegrees");
    ConfigValidation.range(maxSpreadDegrees, 0, 180, "maxSpreadDegrees");
    ConfigValidation.nonnegative(maxSpeedMetersPerSecond, "maxSpeedMetersPerSecond");
    ConfigValidation.nonnegative(maxYawRateDegreesPerSecond, "maxYawRateDegreesPerSecond");
    ConfigValidation.positive(maxSignalAgeSeconds, "maxSignalAgeSeconds");
  }

  public VisionHeadingInitializationConfig withEnabled(boolean enabled) {
    return new VisionHeadingInitializationConfig(enabled, minStableSeconds, minFrames,
        maxSpreadDegrees, maxSpeedMetersPerSecond, maxYawRateDegreesPerSecond, maxSignalAgeSeconds);
  }

  public boolean isStationary(double speedMetersPerSecond, double yawRateDegreesPerSecond) {
    return Double.isFinite(speedMetersPerSecond) && Double.isFinite(yawRateDegreesPerSecond)
        && Math.abs(speedMetersPerSecond) <= maxSpeedMetersPerSecond
        && Math.abs(yawRateDegreesPerSecond) <= maxYawRateDegreesPerSecond;
  }
}
