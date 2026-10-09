package frc.powerlib.health;

import com.ctre.phoenix6.BaseStatusSignal;
import com.ctre.phoenix6.hardware.CANcoder;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.swerve.SwerveDrivetrain;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.subsystems.PowerSubsystem;

/** Shared feedback checks. Simulation requires configured mechanisms and a finite pose. */
public final class HealthChecks {
  private HealthChecks() {}

  public static boolean finitePose(Pose2d pose) {
    return pose != null && Double.isFinite(pose.getX()) && Double.isFinite(pose.getY())
        && Double.isFinite(pose.getRotation().getRadians());
  }

  public static boolean isFresh(double ageSeconds, double maxAgeSeconds) {
    return Double.isFinite(ageSeconds) && Double.isFinite(maxAgeSeconds)
        && ageSeconds >= 0 && maxAgeSeconds >= 0 && ageSeconds <= maxAgeSeconds;
  }

  public static boolean signalHealthy(BaseStatusSignal signal, double maxAgeSeconds) {
    return signal != null && signal.getStatus().isOK() && signal.getTimestamp().isValid()
        && isFresh(signal.getTimestamp().getLatency(), maxAgeSeconds);
  }

  public static boolean mechanismHealthy(PowerSubsystem mechanism, TalonFX motor, double maxAgeSeconds) {
    if (mechanism == null || !mechanism.isConfigured()) return false;
    return RobotBase.isSimulation() || motor != null && motor.isConnected()
        && signalHealthy(motor.getPosition(), maxAgeSeconds) && signalHealthy(motor.getVelocity(), maxAgeSeconds);
  }

  /** Phoenix drivetrain with CANcoder module feedback; does not wait for signals or configure devices. */
  public static boolean driveHealthy(SwerveDrivetrain<?, ?, ? extends CANcoder> drive, double maxAgeSeconds) {
    if (drive == null || !finitePose(drive.getState().Pose)) return false;
    if (RobotBase.isSimulation()) return true;
    if (!signalHealthy(drive.getPigeon2().getYaw(), maxAgeSeconds)) return false;
    for (var module : drive.getModules()) {
      if (!signalHealthy(module.getDriveMotor().getVelocity(), maxAgeSeconds)
          || !signalHealthy(module.getSteerMotor().getPosition(), maxAgeSeconds)
          || !signalHealthy(module.getEncoder().getAbsolutePosition(), maxAgeSeconds)) return false;
    }
    return true;
  }
}
