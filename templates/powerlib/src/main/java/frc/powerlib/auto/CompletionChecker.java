package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import frc.powerlib.configs.CompletionCriteria;
import frc.powerlib.health.HealthChecks;
import java.util.Objects;

/** Evaluates measured arrival once per control update. The caller gates stale feedback separately. */
public final class CompletionChecker {
  private final CompletionCriteria criteria;
  private double settledSince = Double.NaN;
  private double lastTimestamp = Double.NaN;

  public CompletionChecker(CompletionCriteria criteria) {
    this.criteria = Objects.requireNonNull(criteria, "criteria");
  }

  public void reset() {
    settledSince = Double.NaN;
    lastTimestamp = Double.NaN;
  }

  /** Invalid data or backward time breaks the settle window; duplicate timestamps cannot advance it. */
  public boolean update(Pose2d currentPose, Pose2d destination, ChassisSpeeds measuredSpeeds,
      boolean requireHeading, double timestampSeconds) {
    if (!Double.isFinite(timestampSeconds) || timestampSeconds < 0) {
      reset();
      return false;
    }
    boolean backwardTime = timestampSeconds < lastTimestamp;
    lastTimestamp = timestampSeconds;
    if (backwardTime || !HealthChecks.finitePose(currentPose) || !HealthChecks.finitePose(destination)
        || !HealthChecks.finiteSpeeds(measuredSpeeds)
        || currentPose.getTranslation().getDistance(destination.getTranslation()) > criteria.translationToleranceMeters()
        || requireHeading && Math.abs(currentPose.getRotation().minus(destination.getRotation()).getRadians())
            > criteria.headingToleranceRadians()
        || Math.hypot(measuredSpeeds.vxMetersPerSecond, measuredSpeeds.vyMetersPerSecond)
            > criteria.maxTranslationSpeedMetersPerSecond()
        || Math.abs(measuredSpeeds.omegaRadiansPerSecond) > criteria.maxAngularSpeedRadiansPerSecond()) {
      settledSince = Double.NaN;
      return false;
    }
    if (Double.isNaN(settledSince)) settledSince = timestampSeconds;
    return timestampSeconds - settledSince >= criteria.settleTimeSeconds();
  }
}
