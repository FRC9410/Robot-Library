package frc.powerlib.auto;

/**
 * Motion limits and finish condition for one drive-to-pose leg.
 *
 * <p>A leg finishes once the robot is within {@code endDistanceTolerance} meters of the target and
 * moving slower than {@code endVelocityTolerance} meters per second. Larger tolerances release the
 * leg while the robot is still moving, so the next leg can round the corner instead of stopping.
 */
public record DriveConstraints(
    double maxVelocity, double maxAcceleration, double endDistanceTolerance, double endVelocityTolerance) {
  /** Defaults shared with the Power Tool Auto Builder. */
  public static final DriveConstraints DEFAULT = new DriveConstraints(3.0, 3.0, 0.05, 0.1);

  public DriveConstraints {
    requirePositive(maxVelocity, "Max velocity");
    requirePositive(maxAcceleration, "Max acceleration");
    requirePositive(endDistanceTolerance, "End distance tolerance");
    requirePositive(endVelocityTolerance, "End velocity tolerance");
  }

  private static void requirePositive(double value, String name) {
    if (!Double.isFinite(value) || value <= 0) {
      throw new IllegalArgumentException(name + " must be a finite, positive number.");
    }
  }
}
