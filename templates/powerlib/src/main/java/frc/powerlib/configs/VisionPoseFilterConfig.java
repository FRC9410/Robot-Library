package frc.powerlib.configs;

/** Vision position safeguards. Bounds use the same blue-origin field frame as the camera. */
public record VisionPoseFilterConfig(double minX, double maxX, double minY, double maxY,
    double fieldMarginMeters, double maxHeightMeters, double maxTiltDegrees, double levelSettleSeconds,
    double maxOrientationAgeSeconds, double maxSingleCorrectionMeters, int recoveryFrames,
    double recoverySeconds, double recoverySpreadMeters) {
  /** Conservative starting policy; verify thresholds and camera calibration on the robot. */
  public static VisionPoseFilterConfig forField(double minX, double maxX, double minY, double maxY) {
    return new VisionPoseFilterConfig(minX, maxX, minY, maxY, 0.25, 0.5, 8, 0.15, 0.1, 1, 3, 0.1, 0.25);
  }

  public VisionPoseFilterConfig {
    ConfigValidation.finite(minX, "minX");
    ConfigValidation.finite(maxX, "maxX");
    ConfigValidation.finite(minY, "minY");
    ConfigValidation.finite(maxY, "maxY");
    if (maxX <= minX || maxY <= minY) throw new IllegalArgumentException("Field bounds must have positive extent");
    ConfigValidation.nonnegative(fieldMarginMeters, "fieldMarginMeters");
    ConfigValidation.positive(maxHeightMeters, "maxHeightMeters");
    ConfigValidation.positive(maxTiltDegrees, "maxTiltDegrees");
    ConfigValidation.range(maxTiltDegrees, 0, 90, "maxTiltDegrees");
    ConfigValidation.positive(levelSettleSeconds, "levelSettleSeconds");
    ConfigValidation.positive(maxOrientationAgeSeconds, "maxOrientationAgeSeconds");
    ConfigValidation.positive(maxSingleCorrectionMeters, "maxSingleCorrectionMeters");
    if (recoveryFrames < 2) throw new IllegalArgumentException("Recovery needs at least two distinct frames");
    ConfigValidation.positive(recoverySeconds, "recoverySeconds");
    ConfigValidation.positive(recoverySpreadMeters, "recoverySpreadMeters");
  }
}
