// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import frc.powerlib.PowerRobotContainer;
import frc.powerlib.auto.AutoBuilder;
import frc.robot.autos.RobotAutos;
import frc.robot.commands.SwerveDriveCommand;
import frc.robot.Constants;
import frc.robot.subsystems.PowerDashboard;
import frc.robot.subsystems.StateMachine;

public class RobotContainer implements PowerRobotContainer {
  private final StateMachine stateMachine = new StateMachine();
  private final PowerDashboard powerDashboard = new PowerDashboard(stateMachine);
  private final CommandXboxController driverController =
      new CommandXboxController(Constants.OI.DRIVER_CONTROLLER_PORT);
  private final AutoBuilder autoBuilder = new AutoBuilder();

  public RobotContainer() {
    configureBindings();
    stateMachine.drivetrain.setDefaultCommand(
        new SwerveDriveCommand(
            stateMachine.drivetrain, driverController, stateMachine::getCurrentState));
    configureAutos();
  }

  private void configureBindings() {
    // Configure driver controller button commands here.
    // ButtonBindings.bindStates(button, pressState, releaseState, stateMachine::requestState);
    // ButtonBindings.bindFunctions(button, onPress, onRelease);
    // ButtonBindings.bindFunctions(button, onPress, runWhenDisabled);
  }

  private void configureAutos() {
    RobotAutos.register(autoBuilder, stateMachine);
    autoBuilder.publish();
  }

  public Command getAutonomousCommand() {
    return autoBuilder.getAutonomousCommand();
  }

  public StateMachine getStateMachine() {
    return stateMachine;
  }
}



