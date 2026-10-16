package frc.powerlib.configs;

import edu.wpi.first.math.geometry.Pose2d;
import frc.powerlib.auto.RotationTarget;
import frc.powerlib.health.HealthChecks;
import java.util.Objects;

/** Target and policy for one leg. Intermediate arrival uses only the position tolerance. */
public record PathWaypoint(Pose2d pose, MotionConstraints constraints, CompletionCriteria completion,
    RotationTarget rotationTarget, double timeoutSeconds) {
  public PathWaypoint {
    if (!HealthChecks.finitePose(pose)) throw new IllegalArgumentException("Waypoint pose must be finite");
    Objects.requireNonNull(constraints, "constraints");
    Objects.requireNonNull(completion, "completion");
    Objects.requireNonNull(rotationTarget, "rotationTarget");
    ConfigValidation.positive(timeoutSeconds, "timeoutSeconds");
  }

  /** Compatibility: locked legs face the pose heading; unlocked legs do not control heading. */
  public PathWaypoint(Pose2d pose, MotionConstraints constraints, CompletionCriteria completion,
      boolean lockHeading, double timeoutSeconds) {
    this(pose, constraints, completion, legacyTarget(pose, lockHeading), timeoutSeconds);
  }

  public boolean lockHeading() { return rotationTarget.enabled(); }

  private static RotationTarget legacyTarget(Pose2d pose, boolean lockHeading) {
    if (!HealthChecks.finitePose(pose)) throw new IllegalArgumentException("Waypoint pose must be finite");
    return lockHeading ? RotationTarget.fixed(pose.getRotation()) : RotationTarget.NONE;
  }
}
