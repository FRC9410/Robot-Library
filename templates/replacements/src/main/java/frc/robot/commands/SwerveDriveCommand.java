// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.commands;

import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import frc.powerlib.utils.DriveUtil;
import frc.robot.subsystems.Swerve;

public class SwerveDriveCommand extends Command {
  private final Swerve drivetrain;
  private final CommandXboxController controller;

  public SwerveDriveCommand(Swerve drivetrain, CommandXboxController controller) {
    this.drivetrain = drivetrain;
    this.controller = controller;

    addRequirements(drivetrain);
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
