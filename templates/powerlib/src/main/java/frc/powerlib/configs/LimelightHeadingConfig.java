package frc.powerlib.configs;

/** MegaTag1 heading limits. Angles/rates are degrees except estimator uncertainty.
 * maxHeadingErrorDegrees applies while stationary; maxMovingHeadingErrorDegrees applies in motion.
 */
public record LimelightHeadingConfig(
    double headingStdDevRadians,
    double maxTagDistanceMeters,
    double maxMeasurementAgeSeconds,
    double maxYawRateDegreesPerSecond,
    double maxHeadingErrorDegrees,
    double maxMovingHeadingErrorDegrees,
    double maxTagAmbiguity,
    double singleTagMaxDistanceMeters) {
  public static final double DEFAULT_MAX_TAG_DISTANCE_METERS = 4.0;
  public static final double DEFAULT_SINGLE_TAG_MAX_DISTANCE_METERS = 2.0;
  // Weak heading weighting lets the gyro handle fast motion while vision corrects slow drift.
  public static final LimelightHeadingConfig DEFAULT =
      new LimelightHeadingConfig(Math.toRadians(20), DEFAULT_MAX_TAG_DISTANCE_METERS, 0.2, 45, 180, 45, 0.2,
          DEFAULT_SINGLE_TAG_MAX_DISTANCE_METERS);

  /** Compatibility for existing configurations that use the default single-tag limit. */
  public LimelightHeadingConfig(double headingStdDevRadians, double maxTagDistanceMeters,
      double maxMeasurementAgeSeconds, double maxYawRateDegreesPerSecond,
      double maxHeadingErrorDegrees, double maxMovingHeadingErrorDegrees, double maxTagAmbiguity) {
    this(headingStdDevRadians, maxTagDistanceMeters, maxMeasurementAgeSeconds,
        maxYawRateDegreesPerSecond, maxHeadingErrorDegrees, maxMovingHeadingErrorDegrees,
        maxTagAmbiguity, DEFAULT_SINGLE_TAG_MAX_DISTANCE_METERS);
  }

  public LimelightHeadingConfig withDistanceLimits(double maxDistanceMeters, double singleTagDistanceMeters) {
    return new LimelightHeadingConfig(headingStdDevRadians, maxDistanceMeters, maxMeasurementAgeSeconds,
        maxYawRateDegreesPerSecond, maxHeadingErrorDegrees, maxMovingHeadingErrorDegrees,
        maxTagAmbiguity, singleTagDistanceMeters);
  }

  /** Preserves the same limit in both motion conditions for existing configurations. */
  public LimelightHeadingConfig(double headingStdDevRadians, double maxTagDistanceMeters,
      double maxMeasurementAgeSeconds, double maxYawRateDegreesPerSecond,
      double maxHeadingErrorDegrees, double maxTagAmbiguity) {
    this(headingStdDevRadians, maxTagDistanceMeters, maxMeasurementAgeSeconds,
        maxYawRateDegreesPerSecond, maxHeadingErrorDegrees, maxHeadingErrorDegrees, maxTagAmbiguity);
  }

  /** Selects the limit using measured motion. Invalid feedback prevents heading fusion. */
  public double headingErrorLimitDegrees(double speedMetersPerSecond, double yawRateDegreesPerSecond) {
    return headingErrorLimitDegrees(speedMetersPerSecond, yawRateDegreesPerSecond,
        VisionHeadingInitializationConfig.DEFAULT);
  }

  public double headingErrorLimitDegrees(double speedMetersPerSecond, double yawRateDegreesPerSecond,
      VisionHeadingInitializationConfig motionPolicy) {
    if (!Double.isFinite(speedMetersPerSecond) || !Double.isFinite(yawRateDegreesPerSecond)) {
      return Double.NaN;
    }
    boolean stationary = motionPolicy.isStationary(speedMetersPerSecond, yawRateDegreesPerSecond);
    return stationary ? maxHeadingErrorDegrees : maxMovingHeadingErrorDegrees;
  }

  public LimelightHeadingConfig {
    ConfigValidation.positive(headingStdDevRadians, "headingStdDevRadians");
    ConfigValidation.positive(maxTagDistanceMeters, "maxTagDistanceMeters");
    ConfigValidation.positive(singleTagMaxDistanceMeters, "singleTagMaxDistanceMeters");
    ConfigValidation.positive(maxMeasurementAgeSeconds, "maxMeasurementAgeSeconds");
    ConfigValidation.positive(maxYawRateDegreesPerSecond, "maxYawRateDegreesPerSecond");
    ConfigValidation.positive(maxHeadingErrorDegrees, "maxHeadingErrorDegrees");
    ConfigValidation.range(maxHeadingErrorDegrees, 0, 180, "maxHeadingErrorDegrees");
    ConfigValidation.positive(maxMovingHeadingErrorDegrees, "maxMovingHeadingErrorDegrees");
    ConfigValidation.range(maxMovingHeadingErrorDegrees, 0, 180, "maxMovingHeadingErrorDegrees");
    ConfigValidation.range(maxTagAmbiguity, 0, 1, "maxTagAmbiguity");
  }
}
