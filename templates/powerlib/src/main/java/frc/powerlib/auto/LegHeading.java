package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import java.util.Objects;

/**
 * How a drive leg turns: toward its target heading right away (the default), only once the leg
 * is part of the way done, or facing a field point (such as a goal) the whole time. The Power Tool
 * Auto Builder replay runs the same rules, so keep autoReplay.ts in sync with this class.
 */
public final class LegHeading {
  private Translation2d facePoint;
  private double turnStartProgress;
  private Rotation2d lastFacing;

  /** Keep the robot's front pointed at this field point for the whole leg. */
  public void face(Translation2d point) {
    Objects.requireNonNull(point, "Face point must not be null.");
    if (!Double.isFinite(point.getX()) || !Double.isFinite(point.getY())) {
      throw new IllegalArgumentException("Face point must be finite.");
    }
    facePoint = point;
  }

  /** Hold the starting heading until the leg is this fraction (0 to 1) done, then turn. */
  public void turnAfter(double progress) {
    if (!Double.isFinite(progress) || progress < 0 || progress > 1) {
      throw new IllegalArgumentException("Turn start must be between 0 and 1.");
    }
    turnStartProgress = progress;
  }

  public boolean isFacing() { return facePoint != null; }

  /** Start a new run of the leg. */
  public void reset() { lastFacing = null; }

  /** The heading to hold this cycle. */
  public Rotation2d target(Translation2d position, double progress, Rotation2d startHeading, Rotation2d endHeading) {
    if (facePoint != null) {
      Translation2d toPoint = facePoint.minus(position);
      // Right on top of the point there is no direction to face; keep the last one.
      if (toPoint.getNorm() > 1e-3) lastFacing = toPoint.getAngle();
      return lastFacing != null ? lastFacing : endHeading;
    }
    return progress < turnStartProgress ? startHeading : endHeading;
  }
}
