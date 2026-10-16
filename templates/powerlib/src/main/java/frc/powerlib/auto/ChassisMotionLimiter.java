package frc.powerlib.auto;

import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import frc.powerlib.configs.MotionConstraints;
import java.util.Objects;

/**
 * Limits velocity and vector acceleration in one fixed coordinate frame (normally field-relative).
 * Own one instance per active command. The caller supplies elapsed seconds and handles fault stops.
 * These limits shape requests, not measured acceleration or individual module speed.
 */
public final class ChassisMotionLimiter {
  private final MotionConstraints constraints;
  private double vx;
  private double vy;
  private double omega;

  public ChassisMotionLimiter(MotionConstraints constraints) {
    this.constraints = Objects.requireNonNull(constraints, "constraints");
  }

  /** Seed from measured speeds in the same frame. Hard velocity ceilings take priority on reset. */
  public void reset(ChassisSpeeds measuredSpeeds) {
    requireFinite(measuredSpeeds);
    double scale = velocityScale(measuredSpeeds);
    vx = measuredSpeeds.vxMetersPerSecond * scale;
    vy = measuredSpeeds.vyMetersPerSecond * scale;
    omega = MathUtil.clamp(measuredSpeeds.omegaRadiansPerSecond,
        -constraints.maxAngularVelocityRadiansPerSecond(), constraints.maxAngularVelocityRadiansPerSecond());
  }

  /** Zero elapsed time holds the previous request. Invalid inputs throw without changing state. */
  public ChassisSpeeds calculate(ChassisSpeeds desiredSpeeds, double elapsedSeconds) {
    requireFinite(desiredSpeeds);
    if (!Double.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new IllegalArgumentException("elapsedSeconds must be finite and nonnegative");
    }
    double scale = velocityScale(desiredSpeeds);
    double dx = desiredSpeeds.vxMetersPerSecond * scale - vx;
    double dy = desiredSpeeds.vyMetersPerSecond * scale - vy;
    double delta = Math.hypot(dx, dy);
    double maxDelta = constraints.maxAccelerationMetersPerSecondSquared() * elapsedSeconds;
    double deltaScale = delta > maxDelta ? maxDelta / delta : 1;
    vx += dx * deltaScale;
    vy += dy * deltaScale;
    double targetOmega = MathUtil.clamp(desiredSpeeds.omegaRadiansPerSecond,
        -constraints.maxAngularVelocityRadiansPerSecond(), constraints.maxAngularVelocityRadiansPerSecond());
    double maxOmegaDelta = constraints.maxAngularAccelerationRadiansPerSecondSquared() * elapsedSeconds;
    omega += MathUtil.clamp(targetOmega - omega, -maxOmegaDelta, maxOmegaDelta);
    return new ChassisSpeeds(vx, vy, omega);
  }

  private double velocityScale(ChassisSpeeds speeds) {
    double magnitude = Math.hypot(speeds.vxMetersPerSecond, speeds.vyMetersPerSecond);
    return magnitude > constraints.maxVelocityMetersPerSecond()
        ? constraints.maxVelocityMetersPerSecond() / magnitude : 1;
  }

  private static void requireFinite(ChassisSpeeds speeds) {
    Objects.requireNonNull(speeds, "speeds");
    if (!Double.isFinite(speeds.vxMetersPerSecond) || !Double.isFinite(speeds.vyMetersPerSecond)
        || !Double.isFinite(speeds.omegaRadiansPerSecond)) {
      throw new IllegalArgumentException("Chassis speeds must be finite");
    }
  }
}
