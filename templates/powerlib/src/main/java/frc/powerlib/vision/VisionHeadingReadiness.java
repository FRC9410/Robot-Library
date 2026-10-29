package frc.powerlib.vision;

import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.health.HealthChecks;
import java.util.Objects;
import java.util.HashMap;
import java.util.Map;

/** Confirms capture-time heading agreement after gradual fusion, including while moving. */
public final class VisionHeadingReadiness {
  private final VisionHeadingInitializationConfig config;
  private final double maxFrameAgeSeconds;
  private final double maxErrorDegrees;
  private static final class Evidence {
    double firstTimestamp;
    double lastTimestamp = Double.NEGATIVE_INFINITY;
    int count;
  }
  private final Map<String, Evidence> cameras = new HashMap<>();

  public VisionHeadingReadiness(VisionHeadingInitializationConfig config, double maxFrameAgeSeconds,
      double maxErrorDegrees) {
    this.config = Objects.requireNonNull(config);
    if (!Double.isFinite(maxFrameAgeSeconds) || maxFrameAgeSeconds <= 0) {
      throw new IllegalArgumentException("maxFrameAgeSeconds must be positive and finite");
    }
    this.maxFrameAgeSeconds = maxFrameAgeSeconds;
    if (!Double.isFinite(maxErrorDegrees) || maxErrorDegrees <= 0 || maxErrorDegrees > 180) {
      throw new IllegalArgumentException("maxErrorDegrees must be positive and at most 180");
    }
    this.maxErrorDegrees = maxErrorDegrees;
  }

  public void reset() {
    cameras.clear();
  }

  public void reset(String cameraName) { cameras.remove(cameraName); }

  /** Call only for accepted independent heading frames, with error measured before their correction. */
  public boolean observe(double errorDegrees, double timestampSeconds, double now) {
    return observe("", errorDegrees, timestampSeconds, now);
  }

  /** A rejected reading from one camera cannot erase another camera's confirmation window. */
  public boolean observe(String cameraName, double errorDegrees, double timestampSeconds, double now) {
    cameras.values().removeIf(evidence -> !HealthChecks.isFresh(now - evidence.lastTimestamp, maxFrameAgeSeconds));
    if (!HealthChecks.isFresh(now - timestampSeconds, maxFrameAgeSeconds)
        || !LimelightVision.HeadingMeasurement.isErrorAllowed(errorDegrees, maxErrorDegrees)) {
      reset(cameraName);
      return false;
    }
    var evidence = cameras.computeIfAbsent(cameraName, name -> new Evidence());
    if (timestampSeconds <= evidence.lastTimestamp) return false;
    if (timestampSeconds - evidence.lastTimestamp > maxFrameAgeSeconds) evidence.count = 0;
    if (evidence.count == 0) evidence.firstTimestamp = timestampSeconds;
    evidence.lastTimestamp = timestampSeconds;
    evidence.count++;
    return evidence.count >= config.minFrames()
        && timestampSeconds - evidence.firstTimestamp >= config.minStableSeconds();
  }
}
