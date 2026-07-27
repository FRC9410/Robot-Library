// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.subsystems.AbsolutePositionSubsystem;
import frc.powerlib.subsystems.RelativePositionSubsystem;
import frc.powerlib.subsystems.VelocitySubsystem;
import frc.powerlib.subsystems.VelocityTorqueSubsystem;
import frc.robot.Constants;

public class StateMachine extends SubsystemBase {
  public enum RobotState {
    IDLE
  }

  public final Vision vision = new Vision();
  public final Swerve drivetrain = Constants.Tuner.createDrivetrain();

  // POWERLIB GENERATED SUBSYSTEMS START - DO NOT DELETE
  // POWERLIB GENERATED SUBSYSTEMS END - DO NOT DELETE

  private RobotState wantedState = RobotState.IDLE;

  public RobotState getWantedState() {
    return wantedState;
  }

  public void setWantedState(RobotState wantedState) {
    this.wantedState = wantedState;
  }

  @Override
  public void periodic() {}
}
