package frc.powerlib.utils;

import static edu.wpi.first.units.Units.*;

import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.math.util.Units;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import frc.robot.Constants;
import frc.robot.subsystems.Swerve;

public class DriveUtil {

  public static final double MAX_SPEED = Constants.Tuner.kSpeedAt12Volts.in(MetersPerSecond);
  public static final double MAX_DRIVE_TO_POINT_SPEED =
      Constants.Tuner.kSpeedAt12Volts.in(MetersPerSecond) * 0.75;
  public static final double SLOW_DRIVE_TO_POINT_SPEED =
      Constants.Tuner.kSpeedAt12Volts.in(MetersPerSecond) * 0.75 / 4;
  public static final double STATIC_FRICTION_CONSTANT = 0.085;

  public static boolean isClose(Pose2d currentPose, Pose2d targetPose) {
    final Translation2d translationToPoint =
        currentPose.getTranslation().minus(targetPose.getTranslation());
    final double linearDistance = translationToPoint.getNorm();
    return linearDistance < 1; // meters
  }

  /**
   * Calculates the x and y velocity components to drive from currentPose toward targetPose.
   *
   * @param currentPose the robot's current pose
   * @param targetPose the desired target pose
   * @param directionMultiplier alliance-based sign flip (-1 for blue, 1 for red)
   * @param driveToPointController PID controller for distance
   * @param poseTolerance the current pose tolerance value
   * @return a Translation2d whose x/y are the field-relative velocity components
   */
  public static Translation2d calculateDriveToPointVelocity(
      Pose2d currentPose,
      Pose2d targetPose,
      double directionMultiplier,
      PIDController driveToPointController,
      double poseTolerance) {

    final Translation2d translationToPoint =
        currentPose.getTranslation().minus(targetPose.getTranslation());
    final double linearDistance = translationToPoint.getNorm();

    double ff = 0;
    if (linearDistance >= Units.inchesToMeters(0.5)) {
      ff = STATIC_FRICTION_CONSTANT * MAX_SPEED;
    }

    double cappedSpeed = isClose(currentPose, targetPose) && poseTolerance < 6
        ? SLOW_DRIVE_TO_POINT_SPEED : MAX_DRIVE_TO_POINT_SPEED;

    final Rotation2d directionOfTravel = translationToPoint.getAngle();
    final double velocity =
        Math.min(Math.abs(driveToPointController.calculate(linearDistance, 0)) + ff, cappedSpeed);

    final double xSpeed = velocity * directionOfTravel.getCos() * directionMultiplier;
    final double ySpeed = velocity * directionOfTravel.getSin() * directionMultiplier;

    return new Translation2d(xSpeed, ySpeed);
  }

  public static ChassisSpeeds calculateSpeedsBasedOnJoystickInputs(
      CommandXboxController controller,
      Swerve drivetrain,
      double maxAngularRate,
      double skewCompensation) {
    boolean isBlueAlliance = true;
    final Pose2d currentPose = drivetrain.getState().Pose;

    if (DriverStation.getAlliance().isEmpty()) {
      return new ChassisSpeeds(0, 0, 0);
    }

    if (DriverStation.getAlliance().get() == Alliance.Blue) {
      isBlueAlliance = true;
    }

    double xMagnitude = MathUtil.applyDeadband(controller.getLeftY(), 0.1);
    double yMagnitude = MathUtil.applyDeadband(controller.getLeftX(), 0.1);
    double angularMagnitude = MathUtil.applyDeadband(controller.getRightX(), 0.1);

    xMagnitude = Math.copySign(xMagnitude * xMagnitude * xMagnitude, xMagnitude);
    yMagnitude = Math.copySign(yMagnitude * yMagnitude * yMagnitude, yMagnitude);
    angularMagnitude = Math.copySign(angularMagnitude * angularMagnitude, angularMagnitude);

    double xVelocity = (isBlueAlliance ? -xMagnitude * MAX_SPEED : xMagnitude * MAX_SPEED) * 0.95;
    double yVelocity = (isBlueAlliance ? -yMagnitude * MAX_SPEED : yMagnitude * MAX_SPEED) * 0.95;
    double angularVelocity = angularMagnitude * maxAngularRate * 0.95;

    Rotation2d skewCompensationFactor =
        Rotation2d.fromRadians(
            drivetrain.getState().Speeds.omegaRadiansPerSecond * skewCompensation);

    return ChassisSpeeds.fromRobotRelativeSpeeds(
        ChassisSpeeds.fromFieldRelativeSpeeds(
            new ChassisSpeeds(xVelocity, yVelocity, -angularVelocity), currentPose.getRotation()),
        currentPose.getRotation().plus(skewCompensationFactor));
  }
}



