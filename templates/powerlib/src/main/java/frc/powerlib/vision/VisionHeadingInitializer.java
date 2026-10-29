package frc.powerlib.vision;

import edu.wpi.first.math.geometry.Rotation2d;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.health.HealthChecks;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/** Independent stationary stability windows, with an optional one-shot initialization API. */
public final class VisionHeadingInitializer {
  private static final int SINGLE_TAG_MIN_FRAMES = 10;
  private static final double SINGLE_TAG_MIN_STABLE_SECONDS = .5;
  private static final double SINGLE_TAG_MAX_SPREAD_DEGREES = 1;
  private static final class Samples {
    Rotation2d anchor;
    double firstTimestamp;
    double lastTimestamp = Double.NEGATIVE_INFINITY;
    double cosineSum;
    double sineSum;
    double minDelta;
    double maxDelta;
    int count;
    boolean includesSingleTag;
    boolean inconsistent;
    // A multi-tag window must not authorize a later single-tag observation.
    int qualifiedTagCount;

    void reset() {
      anchor = null;
      lastTimestamp = Double.NEGATIVE_INFINITY;
      count = 0;
      includesSingleTag = false;
      inconsistent = false;
      qualifiedTagCount = 0;
      cosineSum = sineSum = minDelta = maxDelta = 0;
    }
  }
  private final VisionHeadingInitializationConfig config;
  private final double maxFrameAgeSeconds;
  private boolean initialized;
  private final Map<String, Samples> cameras = new HashMap<>();
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
  public boolean isInitialized() { return initialized; }
  public boolean isInconsistent(String cameraName) {
    var samples = cameras.get(cameraName);
    return samples != null && samples.inconsistent;
  }

  /** Qualification applies only to the latest fresh observation and its proven tag policy. */
  public boolean isQualified(HeadingMeasurement measurement, double now) {
    var samples = cameras.get(measurement.cameraName());
    return samples != null && samples.qualifiedTagCount > 0
        && measurement.tagCount() >= samples.qualifiedTagCount
        && measurement.timestampSeconds() == samples.lastTimestamp
        && HealthChecks.isFresh(now - measurement.timestampSeconds(), maxFrameAgeSeconds)
        && (measurement.tagCount() >= 2 || measurement.reliableSingleTag(now));
  }

  public void reset() {
    initialized = false;
    clearSamples();
    status = config.enabled() ? "Waiting for stable MT1 heading" : "Automatic heading initialization disabled";
  }

  private void clearSamples() {
    cameras.clear();
  }

  public Optional<Rotation2d> update(HeadingMeasurement measurement, double now,
      double speedMetersPerSecond, double yawRateDegreesPerSecond) {
    if (!config.enabled()) { status = "Automatic heading initialization disabled"; return Optional.empty(); }
    if (initialized) { status = "MT1 heading initialized"; return Optional.empty(); }
    var result = observe(measurement, now, speedMetersPerSecond, yawRateDegreesPerSecond);
    if (result.isPresent()) initialized = true;
    return result;
  }

  /** Passive evidence collection also supports camera handoffs when automatic resets are disabled. */
  public Optional<Rotation2d> observe(HeadingMeasurement measurement, double now,
      double speedMetersPerSecond, double yawRateDegreesPerSecond) {
    if (!config.isStationary(speedMetersPerSecond, yawRateDegreesPerSecond)) {
      clearSamples();
      status = "Waiting for stationary robot";
      return Optional.empty();
    }
    cameras.values().removeIf(samples -> !HealthChecks.isFresh(now - samples.lastTimestamp, maxFrameAgeSeconds));
    if (measurement == null) {
      status = "Waiting for fresh independent heading";
      return Optional.empty();
    }
    if (!HealthChecks.finitePose(measurement.pose())
        || !HealthChecks.isFresh(now - measurement.timestampSeconds(), maxFrameAgeSeconds)
        || measurement.tagCount() < 1
        || measurement.tagCount() == 1 && !measurement.reliableSingleTag(now)) {
      cameras.remove(measurement.cameraName());
      status = "Rejected stale or invalid heading";
      return Optional.empty();
    }
    var samples = cameras.computeIfAbsent(measurement.cameraName(), name -> new Samples());
    if (measurement.timestampSeconds() <= samples.lastTimestamp) return Optional.empty();
    var rotation = measurement.pose().getRotation();
    double delta = samples.anchor == null ? 0 : rotation.minus(samples.anchor).getDegrees();
    boolean includesSingleTag = samples.includesSingleTag || measurement.tagCount() == 1;
    double spreadLimit = includesSingleTag
        ? Math.min(config.maxSpreadDegrees(), SINGLE_TAG_MAX_SPREAD_DEGREES) : config.maxSpreadDegrees();
    boolean inconsistent = samples.anchor != null
        && Math.max(samples.maxDelta, delta) - Math.min(samples.minDelta, delta) > spreadLimit;
    if (samples.anchor == null || measurement.timestampSeconds() - samples.lastTimestamp > maxFrameAgeSeconds
        || inconsistent) {
      samples.reset();
      samples.inconsistent = inconsistent;
      samples.anchor = rotation;
      samples.firstTimestamp = measurement.timestampSeconds();
      delta = 0;
    }
    samples.minDelta = Math.min(samples.minDelta, delta);
    samples.maxDelta = Math.max(samples.maxDelta, delta);
    samples.lastTimestamp = measurement.timestampSeconds();
    samples.cosineSum += rotation.getCos();
    samples.sineSum += rotation.getSin();
    samples.count++;
    samples.includesSingleTag |= measurement.tagCount() == 1;
    status = "Collecting consistent MT1 heading";
    int minFrames = samples.includesSingleTag ? Math.max(config.minFrames(), SINGLE_TAG_MIN_FRAMES) : config.minFrames();
    double minSeconds = samples.includesSingleTag
        ? Math.max(config.minStableSeconds(), SINGLE_TAG_MIN_STABLE_SECONDS) : config.minStableSeconds();
    if (samples.count < minFrames || samples.lastTimestamp - samples.firstTimestamp < minSeconds) {
      return Optional.empty();
    }
    status = "MT1 heading initialized";
    var average = new Rotation2d(samples.cosineSum, samples.sineSum);
    int qualifiedTagCount = samples.includesSingleTag ? 1 : 2;
    // Bound ongoing arbitration to recent windows. Slow real yaw must not accumulate
    // against an anchor retained since startup, and a deferred winner must remain usable.
    samples.reset();
    samples.qualifiedTagCount = qualifiedTagCount;
    samples.anchor = rotation;
    samples.firstTimestamp = samples.lastTimestamp = measurement.timestampSeconds();
    samples.cosineSum = rotation.getCos();
    samples.sineSum = rotation.getSin();
    samples.count = 1;
    samples.includesSingleTag = measurement.tagCount() == 1;
    return Optional.of(average);
  }
}
