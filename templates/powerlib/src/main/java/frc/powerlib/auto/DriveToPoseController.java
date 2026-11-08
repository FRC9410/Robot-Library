package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Translation2d;
import java.util.Objects;

/**
 * Field-relative velocity controller for one drive-to-pose leg.
 *
 * <p>Each cycle it aims straight at the target, slows so it can stop within the remaining distance,
 * and limits how fast the commanded velocity vector may change. Starting from the robot's measured
 * velocity lets a leg that begins while moving curve smoothly into its new direction. The Power Tool
 * Auto Builder replay runs the same math, so keep autoReplay.ts in sync with this class.
 */
public final class DriveToPoseController {
  /** Robot loop period; the controller assumes one call per cycle. */
  public static final double LOOP_PERIOD_SECONDS = 0.02;
  /** Final-approach gain (1/s) that keeps the last few centimeters smooth instead of abrupt. */
  public static final double POSITION_GAIN = 4.0;

  private final DriveConstraints constraints;
  private Translation2d command = Translation2d.kZero;

  public DriveToPoseController(DriveConstraints constraints) {
    this.constraints = Objects.requireNonNull(constraints, "Drive constraints must not be null.");
  }

  public DriveConstraints getConstraints() { return constraints; }

  /** Start a leg from the robot's measured field-relative velocity. */
  public void reset(Translation2d measuredFieldVelocity) {
    command = Objects.requireNonNull(measuredFieldVelocity, "Velocity must not be null.");
  }

  /** Returns the field-relative velocity to command this cycle, in meters per second. */
  public Translation2d calculate(Translation2d position, Translation2d target) {
    Translation2d error = target.minus(position);
    double distance = error.getNorm();
    double speed = Math.min(constraints.maxVelocity(),
        Math.min(Math.sqrt(2 * constraints.maxAcceleration() * distance), POSITION_GAIN * distance));
    Translation2d desired = distance > 1e-9 ? error.times(speed / distance) : Translation2d.kZero;
    Translation2d change = desired.minus(command);
    double maxChange = constraints.maxAcceleration() * LOOP_PERIOD_SECONDS;
    if (change.getNorm() > maxChange) change = change.times(maxChange / change.getNorm());
    command = command.plus(change);
    return command;
  }

  /** Fraction (0 to 1) of the straight line from start to target the robot has covered, by projection. */
  public static double progress(Translation2d start, Translation2d position, Translation2d target) {
    Translation2d leg = target.minus(start);
    double lengthSquared = leg.getX() * leg.getX() + leg.getY() * leg.getY();
    if (lengthSquared < 1e-12) return 1;
    Translation2d moved = position.minus(start);
    return Math.min(1, Math.max(0, (moved.getX() * leg.getX() + moved.getY() * leg.getY()) / lengthSquared));
  }

  /** True once the robot is inside both end tolerances. */
  public boolean atGoal(Translation2d position, Translation2d measuredFieldVelocity, Translation2d target) {
    return position.getDistance(target) <= constraints.endDistanceTolerance()
        && measuredFieldVelocity.getNorm() <= constraints.endVelocityTolerance();
  }
}
