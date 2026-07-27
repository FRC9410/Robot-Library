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
import frc.powerlib.PowerRobotContainer;
import frc.robot.Constants;
import frc.robot.constants.SwerveConstants;
import frc.robot.subsystems.Swerve;

public class DriveUtil {
  private static final String SWERVE_TUNING_SUBSYSTEM_NAME = "Swerve";
  private static final double DEFAULT_DRIVE_TO_POINT_MAX_SPEED_COEFFICIENT =
      SwerveConstants.DRIVE_TO_POINT_MAX_SPEED_COEFFICIENT;
  private static final double DEFAULT_DRIVE_TO_POINT_SLOW_SPEED_COEFFICIENT =
      SwerveConstants.DRIVE_TO_POINT_SLOW_SPEED_COEFFICIENT;
  private static final double DEFAULT_DRIVE_TO_POINT_STATIC_FRICTION_CONSTANT =
      SwerveConstants.DRIVE_TO_POINT_STATIC_FRICTION_CONSTANT;

  public static final double MAX_SPEED = Constants.Tuner.kSpeedAt12Volts.in(MetersPerSecond);
  public static final double MAX_DRIVE_TO_POINT_SPEED =
      Constants.Tuner.kSpeedAt12Volts.in(MetersPerSecond)
          * SwerveConstants.DRIVE_TO_POINT_MAX_SPEED_COEFFICIENT;
  public static final double SLOW_DRIVE_TO_POINT_SPEED =
      Constants.Tuner.kSpeedAt12Volts.in(MetersPerSecond)
          * SwerveConstants.DRIVE_TO_POINT_SLOW_SPEED_COEFFICIENT;
  public static final double STATIC_FRICTION_CONSTANT =
      SwerveConstants.DRIVE_TO_POINT_STATIC_FRICTION_CONSTANT;

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
    double maxSpeedCoefficient =
        getSwerveVariable(
            "DriveToPoint/MaxSpeedCoefficient", DEFAULT_DRIVE_TO_POINT_MAX_SPEED_COEFFICIENT);
    double slowSpeedCoefficient =
        getSwerveVariable(
            "DriveToPoint/SlowSpeedCoefficient", DEFAULT_DRIVE_TO_POINT_SLOW_SPEED_COEFFICIENT);
    double staticFrictionConstant =
        getSwerveVariable(
            "DriveToPoint/StaticFrictionConstant",
            DEFAULT_DRIVE_TO_POINT_STATIC_FRICTION_CONSTANT);

    double ff = 0;
    if (linearDistance >= Units.inchesToMeters(0.5)) {
      ff = staticFrictionConstant * MAX_SPEED;
    }

    double cappedSpeed = isClose(currentPose, targetPose) && poseTolerance < 6
        ? MAX_SPEED * slowSpeedCoefficient
        : MAX_SPEED * maxSpeedCoefficient;

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

    double joystickDeadband = drivetrain.getDriverJoystickDeadband();
    double velocityScale = drivetrain.getDriverVelocityScale();

    double xMagnitude = MathUtil.applyDeadband(controller.getLeftY(), joystickDeadband);
    double yMagnitude = MathUtil.applyDeadband(controller.getLeftX(), joystickDeadband);
    double angularMagnitude = MathUtil.applyDeadband(controller.getRightX(), joystickDeadband);

    xMagnitude = Math.copySign(xMagnitude * xMagnitude * xMagnitude, xMagnitude);
    yMagnitude = Math.copySign(yMagnitude * yMagnitude * yMagnitude, yMagnitude);
    angularMagnitude = Math.copySign(angularMagnitude * angularMagnitude, angularMagnitude);

    double xVelocity =
        (isBlueAlliance ? -xMagnitude * drivetrain.MAX_SPEED : xMagnitude * drivetrain.MAX_SPEED)
            * velocityScale;
    double yVelocity =
        (isBlueAlliance ? -yMagnitude * drivetrain.MAX_SPEED : yMagnitude * drivetrain.MAX_SPEED)
            * velocityScale;
    double angularVelocity = angularMagnitude * maxAngularRate * velocityScale;

    Rotation2d skewCompensationFactor =
        Rotation2d.fromRadians(
            drivetrain.getState().Speeds.omegaRadiansPerSecond * skewCompensation);

    return ChassisSpeeds.fromRobotRelativeSpeeds(
        ChassisSpeeds.fromFieldRelativeSpeeds(
            new ChassisSpeeds(xVelocity, yVelocity, -angularVelocity), currentPose.getRotation()),
        currentPose.getRotation().plus(skewCompensationFactor));
  }

  private static double getSwerveVariable(String key, double defaultValue) {
    return PowerRobotContainer.getSubsystemVariable(SWERVE_TUNING_SUBSYSTEM_NAME, key, defaultValue);
  }
}



