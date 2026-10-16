package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import frc.powerlib.health.HealthChecks;
import java.util.Objects;
import java.util.function.Function;

/** Field-relative heading policy, independent of the path's translation destinations. */
public final class RotationTarget {
  public static final RotationTarget NONE = new RotationTarget(null);
  private final Function<Pose2d, Rotation2d> target;

  private RotationTarget(Function<Pose2d, Rotation2d> target) { this.target = target; }

  public static RotationTarget fixed(Rotation2d heading) {
    requireHeading(heading);
    return new RotationTarget(pose -> heading);
  }

  /** The function must be side-effect free; the drive command resolves it once per update. */
  public static RotationTarget live(Function<Pose2d, Rotation2d> target) {
    return new RotationTarget(Objects.requireNonNull(target, "target"));
  }

  public static RotationTarget facePoint(Translation2d point) {
    return facePoint(point, Rotation2d.kZero);
  }

  /** Offset zero faces forward at the point; 180 degrees aims the rear of the robot at it. */
  public static RotationTarget facePoint(Translation2d point, Rotation2d offset) {
    if (point == null || !Double.isFinite(point.getX()) || !Double.isFinite(point.getY())) {
      throw new IllegalArgumentException("Rotation target point must be finite");
    }
    requireHeading(offset);
    return live(pose -> {
      double dx = point.getX() - pose.getX();
      double dy = point.getY() - pose.getY();
      if (!Double.isFinite(dx) || !Double.isFinite(dy) || dx == 0 && dy == 0) {
        throw new IllegalArgumentException("Cannot face an undefined direction");
      }
      return Rotation2d.fromRadians(Math.atan2(dy, dx)).plus(offset);
    });
  }

  public boolean enabled() { return target != null; }

  /** Disabled policies must not be resolved. Invalid or unavailable enabled targets are errors. */
  public Rotation2d resolve(Pose2d pose) {
    if (!enabled()) throw new IllegalStateException("Rotation control is disabled");
    if (!HealthChecks.finitePose(pose)) throw new IllegalArgumentException("Robot pose must be finite");
    final Rotation2d heading;
    try {
      heading = target.apply(pose);
    } catch (RuntimeException exception) {
      throw new IllegalArgumentException("Rotation target unavailable", exception);
    }
    requireHeading(heading);
    return heading;
  }

  private static void requireHeading(Rotation2d heading) {
    if (heading == null || !Double.isFinite(heading.getRadians())) {
      throw new IllegalArgumentException("Rotation target heading must be finite");
    }
  }
}
