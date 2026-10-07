package frc.powerlib.configs;

/** MegaTag2 measurement limits. Distances are meters and ages are seconds. */
public record LimelightVisionConfig(
    double basePositionStdDev, double maxTagDistanceMeters, double maxMeasurementAgeSeconds) {
  public static final LimelightVisionConfig DEFAULT = new LimelightVisionConfig(0.07, 6.25, 0.5);

  public LimelightVisionConfig {
    requirePositive(basePositionStdDev, "basePositionStdDev");
    requirePositive(maxTagDistanceMeters, "maxTagDistanceMeters");
    requirePositive(maxMeasurementAgeSeconds, "maxMeasurementAgeSeconds");
  }

  private static void requirePositive(double value, String name) {
    if (!Double.isFinite(value) || value <= 0.0) {
      throw new IllegalArgumentException(name + " must be finite and positive");
    }
  }
}
