package frc.robot.commands;

import com.ctre.phoenix6.BaseStatusSignal;
import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.StatusSignal;
import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.units.measure.Angle;
import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.auto.BumpCrossingCommand;
import frc.powerlib.configs.BumpCrossingConfig;
import frc.powerlib.health.HealthChecks;
import frc.robot.subsystems.Swerve;
import frc.robot.subsystems.Vision;
import java.util.Objects;
import java.util.function.Consumer;

/** Phoenix/Pigeon adapter; crossing detection and completion live in PowerLib. */
public final class CrossBumpCommand extends BumpCrossingCommand {
  public CrossBumpCommand(Swerve drivetrain, Vision vision, BumpCrossingConfig config,
      boolean reversed, Consumer<String> abort) {
    super(drivetrain, adapter(drivetrain, vision, config), config, reversed, abort);
  }

  private static Drive adapter(Swerve drive, Vision vision, BumpCrossingConfig config) {
    Objects.requireNonNull(drive, "drivetrain");
    Objects.requireNonNull(config, "config");
    if (config.requireVisionRecovery()) Objects.requireNonNull(vision, "vision recovery requires Vision");
    return new Drive() {
      private final StatusSignal<Angle> yaw = drive.getPigeon2().getYaw();
      private final StatusSignal<Angle> pitch = drive.getPigeon2().getPitch();
      private final StatusSignal<Angle> roll = drive.getPigeon2().getRoll();
      private final SwerveRequest.RobotCentric request = new SwerveRequest.RobotCentric()
          .withDriveRequestType(DriveRequestType.Velocity);
      private final SwerveRequest.SwerveDriveBrake brake = new SwerveRequest.SwerveDriveBrake();
      private Double headingSetpoint;

      @Override public void readInputs(Inputs inputs) {
        BaseStatusSignal.refreshAll(yaw, pitch, roll); // Nonblocking refresh, never waitForAll.
        inputs.yawRadians = Math.toRadians(yaw.getValueAsDouble());
        // Pigeon pitch is nose-down positive; the shared detector uses nose-up positive.
        inputs.pitchDegrees = -pitch.getValueAsDouble();
        inputs.rollDegrees = roll.getValueAsDouble();
        inputs.robotSpeeds = drive.getState().Speeds;
        inputs.healthy = HealthChecks.driveHealthy(drive, config.maxSignalAgeSeconds())
            && (RobotBase.isSimulation() || HealthChecks.signalHealthy(yaw, config.maxSignalAgeSeconds())
                && HealthChecks.signalHealthy(pitch, config.maxSignalAgeSeconds())
                && HealthChecks.signalHealthy(roll, config.maxSignalAgeSeconds()));
        inputs.signalAgeSeconds = RobotBase.isSimulation() ? 0 : Math.max(yaw.getTimestamp().getLatency(),
            Math.max(pitch.getTimestamp().getLatency(), roll.getTimestamp().getLatency()));
        inputs.visionPositionTimestampSeconds = vision == null ? Double.NEGATIVE_INFINITY
            : vision.getLastAppliedPositionTimestampSeconds();
      }

      @Override public void resetHeadingController() {
        drive.resetAutonomousHeadingController();
        headingSetpoint = null;
      }

      @Override public double headingRate(Rotation2d current, Rotation2d target) {
        headingSetpoint = drive.getState().Pose.getRotation().plus(target.minus(current)).getDegrees();
        return drive.calculateAutonomousHeadingRate(current, target);
      }

      @Override public void applyRobotSpeeds(ChassisSpeeds speeds) {
        drive.applyRequest(request.withVelocityX(speeds.vxMetersPerSecond).withVelocityY(speeds.vyMetersPerSecond)
            .withRotationalRate(speeds.omegaRadiansPerSecond), headingSetpoint);
      }

      @Override public void stop() { drive.applyRequest(brake); }

      @Override public void recordPhase(Phase phase) {
        SignalLogger.writeString("Robot/Auto/Bump/Phase", phase.name());
      }
    };
  }
}
