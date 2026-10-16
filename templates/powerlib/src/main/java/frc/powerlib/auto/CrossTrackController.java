package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import frc.powerlib.configs.CrossTrackConfig;
import java.util.Objects;

/** Stateless segment steering. Writes field-relative translation only; the caller owns omega and acceleration limits. */
public final class CrossTrackController {
  private final CrossTrackConfig config;

  public CrossTrackController(CrossTrackConfig config) {
    this.config = Objects.requireNonNull(config, "config");
  }

  /** The complete translation request stays inside speedBudget. Invalid input leaves the output unchanged. */
  public void calculate(PathProgress.Segment segment, Translation2d position, double speedBudgetMetersPerSecond,
      ChassisSpeeds output) {
    Objects.requireNonNull(segment, "segment");
    Objects.requireNonNull(output, "output");
    if (position == null || !Double.isFinite(position.getX()) || !Double.isFinite(position.getY())
        || !Double.isFinite(speedBudgetMetersPerSecond) || speedBudgetMetersPerSecond < 0) {
      throw new IllegalArgumentException("Position and nonnegative speed budget must be finite");
    }
    double dx = segment.end().getX() - position.getX();
    double dy = segment.end().getY() - position.getY();
    double distance = Math.hypot(dx, dy);
    double along = (position.getX() - segment.start().getX()) * segment.unitX()
        + (position.getY() - segment.start().getY()) * segment.unitY();
    double error = -(position.getX() - segment.start().getX()) * segment.unitY()
        + (position.getY() - segment.start().getY()) * segment.unitX();
    if (!Double.isFinite(distance) || !Double.isFinite(along) || !Double.isFinite(error)) {
      throw new IllegalArgumentException("Segment error exceeds finite range");
    }
    double vx = 0;
    double vy = 0;
    if (distance > 0 && speedBudgetMetersPerSecond > 0) {
      if (!config.enabled() || segment.lengthMeters() == 0 || along < 0 || along >= segment.lengthMeters()) {
        // Direct target recovery also handles overshoot, zero-length legs, and disabled correction.
        vx = dx / distance * speedBudgetMetersPerSecond;
        vy = dy / distance * speedBudgetMetersPerSecond;
      } else {
        // Ease forward motion as the arrival plane approaches while lateral error remains.
        double forward = speedBudgetMetersPerSecond * ((segment.lengthMeters() - along) / distance);
        double cap = config.maxCorrectionSpeedMetersPerSecond();
        double lateral = Math.max(-cap, Math.min(cap, -config.gainPerSecond() * error));
        double magnitude = Math.hypot(forward, lateral);
        if (!Double.isFinite(magnitude)) throw new IllegalArgumentException("Correction exceeds finite range");
        double scale = magnitude > speedBudgetMetersPerSecond ? speedBudgetMetersPerSecond / magnitude : 1;
        forward *= scale;
        lateral *= scale;
        vx = forward * segment.unitX() - lateral * segment.unitY();
        vy = forward * segment.unitY() + lateral * segment.unitX();
      }
    }
    if (!Double.isFinite(vx) || !Double.isFinite(vy)) throw new IllegalArgumentException("Steering exceeds finite range");
    output.vxMetersPerSecond = vx;
    output.vyMetersPerSecond = vy;
  }
}
