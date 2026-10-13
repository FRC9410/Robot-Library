package frc.powerlib.configs;

/** Conservative MegaTag1 heading limits. Angles/rates are degrees except estimator uncertainty. */
public record LimelightHeadingConfig(
    double headingStdDevRadians,
    double maxTagDistanceMeters,
    double maxMeasurementAgeSeconds,
    double maxYawRateDegreesPerSecond,
    double maxHeadingErrorDegrees,
    double maxTagAmbiguity) {
  // Weak heading weighting lets the gyro handle fast motion while vision corrects slow drift.
  public static final LimelightHeadingConfig DEFAULT =
      new LimelightHeadingConfig(Math.toRadians(20), 4, 0.2, 45, 15, 0.2);

  public LimelightHeadingConfig {
    ConfigValidation.positive(headingStdDevRadians, "headingStdDevRadians");
    ConfigValidation.positive(maxTagDistanceMeters, "maxTagDistanceMeters");
    ConfigValidation.positive(maxMeasurementAgeSeconds, "maxMeasurementAgeSeconds");
    ConfigValidation.positive(maxYawRateDegreesPerSecond, "maxYawRateDegreesPerSecond");
    ConfigValidation.positive(maxHeadingErrorDegrees, "maxHeadingErrorDegrees");
    ConfigValidation.range(maxHeadingErrorDegrees, 0, 180, "maxHeadingErrorDegrees");
    ConfigValidation.range(maxTagAmbiguity, 0, 1, "maxTagAmbiguity");
  }
}
