package frc.powerlib.vision;

import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.health.HealthChecks;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Retains a usable heading camera across frame gaps; stronger challengers need sustained evidence. */
public final class VisionHeadingSelector {
  private static final class Evidence {
    double firstTimestamp;
    double lastTimestamp = Double.NEGATIVE_INFINITY;
    int count;
  }
  private final VisionHeadingInitializationConfig config;
  private final double maxAgeSeconds;
  private final Map<String, Evidence> challengers = new HashMap<>();
  private HeadingMeasurement selected;

  public VisionHeadingSelector(VisionHeadingInitializationConfig config, double maxAgeSeconds) {
    this.config = Objects.requireNonNull(config);
    if (!Double.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
      throw new IllegalArgumentException("maxAgeSeconds must be positive and finite");
    }
    this.maxAgeSeconds = maxAgeSeconds;
  }

  public void reset() { selected = null; challengers.clear(); }

  /** Only supply fresh candidates that have passed capture-time safeguards. Does not replay cached frames. */
  public void update(List<HeadingMeasurement> candidates, double now) {
    if (selected == null) return;
    for (var candidate : candidates) {
      if (candidate.cameraName().equals(selected.cameraName()) && fresh(candidate, now)
          && candidate.timestampSeconds() > selected.timestampSeconds()) selected = candidate;
    }
    if (!fresh(selected, now)) { reset(); return; }
    challengers.values().removeIf(evidence -> !HealthChecks.isFresh(now - evidence.lastTimestamp, maxAgeSeconds));
    for (var candidate : candidates) {
      if (candidate.cameraName().equals(selected.cameraName())) continue;
      if (!fresh(candidate, now) || !candidate.higherQualityThan(selected)) {
        challengers.remove(candidate.cameraName());
        continue;
      }
      var evidence = challengers.computeIfAbsent(candidate.cameraName(), name -> new Evidence());
      if (candidate.timestampSeconds() <= evidence.lastTimestamp) continue;
      if (candidate.timestampSeconds() - evidence.lastTimestamp > maxAgeSeconds) evidence.count = 0;
      if (evidence.count == 0) evidence.firstTimestamp = candidate.timestampSeconds();
      evidence.lastTimestamp = candidate.timestampSeconds();
      evidence.count++;
    }
  }

  /** Call before applying a candidate. Stationary hard resets must also pass their stability collector. */
  public boolean allows(HeadingMeasurement candidate, double now) {
    return allows(candidate, now, true);
  }

  public boolean allows(HeadingMeasurement candidate, double now, boolean allowStrongerChallenger) {
    if (!fresh(candidate, now)) return false;
    if (selected == null || !fresh(selected, now) || candidate.cameraName().equals(selected.cameraName())) return true;
    var evidence = challengers.get(candidate.cameraName());
    return allowStrongerChallenger && candidate.higherQualityThan(selected)
        && evidence != null && evidence.count >= config.minFrames()
        && evidence.lastTimestamp - evidence.firstTimestamp >= config.minStableSeconds();
  }

  /** Commit only an accepted correction or a stable stationary candidate, never a tentative ranking. */
  public void select(HeadingMeasurement candidate) {
    if (selected == null || !candidate.cameraName().equals(selected.cameraName())) challengers.clear();
    selected = candidate;
  }

  /** A downstream rejection invalidates only that camera's claim. */
  public void reject(String cameraName) {
    if (selected != null && selected.cameraName().equals(cameraName)) reset();
    else challengers.remove(cameraName);
  }

  private boolean fresh(HeadingMeasurement measurement, double now) {
    return HealthChecks.finitePose(measurement.pose())
        && HealthChecks.isFresh(now - measurement.timestampSeconds(), maxAgeSeconds)
        && (measurement.tagCount() >= 2 || measurement.reliableSingleTag(now));
  }
}
