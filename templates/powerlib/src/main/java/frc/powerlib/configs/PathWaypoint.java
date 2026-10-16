package frc.powerlib.configs;

import edu.wpi.first.math.geometry.Pose2d;
import frc.powerlib.health.HealthChecks;
import java.util.Objects;

/** Target and policy for one leg. Intermediate arrival uses only the position tolerance. */
public record PathWaypoint(Pose2d pose, MotionConstraints constraints, CompletionCriteria completion,
    boolean lockHeading, double timeoutSeconds) {
  public PathWaypoint {
    if (!HealthChecks.finitePose(pose)) throw new IllegalArgumentException("Waypoint pose must be finite");
    Objects.requireNonNull(constraints, "constraints");
    Objects.requireNonNull(completion, "completion");
    ConfigValidation.positive(timeoutSeconds, "timeoutSeconds");
  }
}
