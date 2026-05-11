// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import frc.powerlib.PowerRobotContainer;
import frc.robot.commands.SwerveDriveCommand;
import frc.robot.Constants;
import frc.robot.subsystems.PowerDashboard;
import frc.robot.subsystems.StateMachine;

public class RobotContainer implements PowerRobotContainer {
  private final StateMachine stateMachine = new StateMachine();
  private final PowerDashboard powerDashboard = new PowerDashboard(stateMachine);
  private final CommandXboxController driverController =
      new CommandXboxController(Constants.OI.DRIVER_CONTROLLER_PORT);

  public RobotContainer() {
    configureBindings();
    stateMachine.drivetrain.setDefaultCommand(
        new SwerveDriveCommand(stateMachine.drivetrain, driverController));
  }

  private void configureBindings() {}

  public Command getAutonomousCommand() {
    return Commands.print("No autonomous command configured");
  }

  public StateMachine getStateMachine() {
    return stateMachine;
  }
}



