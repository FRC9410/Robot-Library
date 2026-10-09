// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.commands;

import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import frc.powerlib.utils.DriveUtil;
import frc.robot.subsystems.Swerve;
import frc.robot.subsystems.StateMachine.RobotState;
import java.util.Objects;
import java.util.function.Supplier;

public class SwerveDriveCommand extends Command {
  private final Swerve drivetrain;
  private final CommandXboxController controller;
  private final Supplier<RobotState> currentStateSupplier;

  public SwerveDriveCommand(
      Swerve drivetrain, CommandXboxController controller, Supplier<RobotState> currentStateSupplier) {
    this.drivetrain = drivetrain;
    this.controller = controller;
    this.currentStateSupplier = Objects.requireNonNull(currentStateSupplier);

    addRequirements(drivetrain);
  }

  /** Reads the robot's latest state when needed by drive behavior. */
  public RobotState getCurrentState() {
    return currentStateSupplier.get();
  }

  @Override
  public void execute() {
    ChassisSpeeds speeds =
        DriveUtil.calculateSpeedsBasedOnJoystickInputs(
            controller,
            drivetrain,
            drivetrain.getDriverMaxAngularRateRadiansPerSecond(),
            drivetrain.getDriverSkewCompensation());

    drivetrain.drive(
        speeds.vxMetersPerSecond * drivetrain.getDriverMaxSpeedCoefficient(),
        speeds.vyMetersPerSecond * drivetrain.getDriverMaxSpeedCoefficient(),
        -speeds.omegaRadiansPerSecond,
        Swerve.DriveMode.FIELD_RELATIVE);
  }

  @Override
  public boolean isFinished() {
    return false;
  }
}
