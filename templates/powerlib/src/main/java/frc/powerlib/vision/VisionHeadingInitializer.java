package frc.powerlib.vision;

import edu.wpi.first.math.geometry.Rotation2d;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.health.HealthChecks;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import java.util.Objects;
import java.util.Optional;

/** One heading seed per disabled period, after stable independent camera frames. */
public final class VisionHeadingInitializer {
  private final VisionHeadingInitializationConfig config;
  private final double maxFrameAgeSeconds;
  private boolean initialized;
  private String camera;
  private Rotation2d anchor;
  private double firstTimestamp;
  private double lastTimestamp = Double.NEGATIVE_INFINITY;
  private double cosineSum;
  private double sineSum;
  private double minDelta;
  private double maxDelta;
  private int count;
  private String status = "Waiting for stable MT1 heading";

  public VisionHeadingInitializer(VisionHeadingInitializationConfig config, double maxFrameAgeSeconds) {
    this.config = Objects.requireNonNull(config);
    if (!Double.isFinite(maxFrameAgeSeconds) || maxFrameAgeSeconds <= 0) {
      throw new IllegalArgumentException("maxFrameAgeSeconds must be positive and finite");
    }
    this.maxFrameAgeSeconds = maxFrameAgeSeconds;
    reset();
  }

  public String status() { return status; }

  public void reset() {
    initialized = false;
    clearSamples();
    status = config.enabled() ? "Waiting for stable MT1 heading" : "Automatic heading initialization disabled";
  }

  private void clearSamples() {
    camera = null;
    anchor = null;
    lastTimestamp = Double.NEGATIVE_INFINITY;
    count = 0;
    cosineSum = sineSum = 0;
    minDelta = maxDelta = 0;
  }

  public Optional<Rotation2d> update(HeadingMeasurement measurement, double now,
      double speedMetersPerSecond, double yawRateDegreesPerSecond) {
    if (!config.enabled()) return Optional.empty();
    if (initialized) { status = "MT1 heading initialized"; return Optional.empty(); }
    if (!Double.isFinite(speedMetersPerSecond) || !Double.isFinite(yawRateDegreesPerSecond)
        || Math.abs(speedMetersPerSecond) > config.maxSpeedMetersPerSecond()
        || Math.abs(yawRateDegreesPerSecond) > config.maxYawRateDegreesPerSecond()) {
      clearSamples();
      status = "Waiting for stationary robot";
      return Optional.empty();
    }
    if (measurement == null) {
      if (!HealthChecks.isFresh(now - lastTimestamp, maxFrameAgeSeconds)) clearSamples();
      status = "Waiting for fresh independent heading";
      return Optional.empty();
    }
    if (!HealthChecks.finitePose(measurement.pose())
        || !HealthChecks.isFresh(now - measurement.timestampSeconds(), maxFrameAgeSeconds)) {
      clearSamples();
      status = "Rejected stale or invalid heading";
      return Optional.empty();
    }
    if (measurement.timestampSeconds() <= lastTimestamp) return Optional.empty();
    var rotation = measurement.pose().getRotation();
    double delta = anchor == null ? 0 : rotation.minus(anchor).getDegrees();
    if (anchor == null || !measurement.cameraName().equals(camera)
        || measurement.timestampSeconds() - lastTimestamp > maxFrameAgeSeconds
        || Math.max(maxDelta, delta) - Math.min(minDelta, delta) > config.maxSpreadDegrees()) {
      clearSamples();
      camera = measurement.cameraName();
      anchor = rotation;
      firstTimestamp = measurement.timestampSeconds();
      delta = 0;
    }
    minDelta = Math.min(minDelta, delta);
    maxDelta = Math.max(maxDelta, delta);
    lastTimestamp = measurement.timestampSeconds();
    cosineSum += rotation.getCos();
    sineSum += rotation.getSin();
    count++;
    status = "Collecting consistent MT1 heading";
    if (count < config.minFrames() || lastTimestamp - firstTimestamp < config.minStableSeconds()) {
      return Optional.empty();
    }
    initialized = true;
    status = "MT1 heading initialized";
    return Optional.of(new Rotation2d(cosineSum, sineSum));
  }
}
