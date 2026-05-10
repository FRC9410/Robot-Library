// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.commands;

import static edu.wpi.first.units.Units.MetersPerSecond;
import static edu.wpi.first.units.Units.RadiansPerSecond;
import static edu.wpi.first.units.Units.RotationsPerSecond;

import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import frc.robot.Constants;
import frc.robot.subsystems.Swerve;
import frc.robot.utils.DriveUtil;

public class SwerveDriveCommand extends Command {
  private final Swerve drivetrain;
  private final CommandXboxController controller;
  private final boolean autoDrive;

  public final double maxSpeed = Constants.Tuner.kSpeedAt12Volts.in(MetersPerSecond);
  public final double maxAngularRate = RotationsPerSecond.of(1.5).in(RadiansPerSecond);
  public final double skewCompensation = -0.03;

  public SwerveDriveCommand(Swerve drivetrain, CommandXboxController controller, boolean autoDrive) {
    this.drivetrain = drivetrain;
    this.controller = controller;
    this.autoDrive = autoDrive;

    addRequirements(drivetrain);
  }

  @Override
  public void execute() {
    ChassisSpeeds speeds =
        DriveUtil.calculateSpeedsBasedOnJoystickInputs(
            controller, drivetrain, maxAngularRate, skewCompensation);

    drivetrain.drive(
        speeds.vxMetersPerSecond * Constants.OI.MAX_SPEED_COEFFICIENT,
        speeds.vyMetersPerSecond * Constants.OI.MAX_SPEED_COEFFICIENT,
        -speeds.omegaRadiansPerSecond,
        Swerve.DriveMode.FIELD_RELATIVE);
  }

  @Override
  public boolean isFinished() {
    return false;
  }
}
