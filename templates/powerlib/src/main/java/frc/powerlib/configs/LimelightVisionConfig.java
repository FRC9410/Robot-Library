package frc.powerlib.configs;

/** MegaTag2 measurement limits. Distances are meters and ages are seconds. */
public record LimelightVisionConfig(
    double basePositionStdDev, double maxTagDistanceMeters, double maxMeasurementAgeSeconds,
    double targetAreaThreshold) {
  public static final LimelightVisionConfig DEFAULT = new LimelightVisionConfig(0.07, 6.25, 0.5);

  public LimelightVisionConfig(double basePositionStdDev, double maxTagDistanceMeters, double maxMeasurementAgeSeconds) {
    this(basePositionStdDev, maxTagDistanceMeters, maxMeasurementAgeSeconds, 0.0);
  }

  public LimelightVisionConfig withPositionLimits(double maxDistanceMeters, double minimumAreaPercent) {
    return new LimelightVisionConfig(basePositionStdDev, maxDistanceMeters, maxMeasurementAgeSeconds, minimumAreaPercent);
  }

  public LimelightVisionConfig {
    requirePositive(basePositionStdDev, "basePositionStdDev");
    requirePositive(maxTagDistanceMeters, "maxTagDistanceMeters");
    requirePositive(maxMeasurementAgeSeconds, "maxMeasurementAgeSeconds");
    ConfigValidation.range(targetAreaThreshold, 0, 100, "targetAreaThreshold");
  }

  private static void requirePositive(double value, String name) {
    if (!Double.isFinite(value) || value <= 0.0) {
      throw new IllegalArgumentException(name + " must be finite and positive");
    }
  }
}
