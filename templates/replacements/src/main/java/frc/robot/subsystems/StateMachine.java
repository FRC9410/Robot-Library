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

  public final Swerve drivetrain = Constants.Tuner.createDrivetrain();
  public final Vision vision = new Vision(drivetrain);

  // POWERLIB GENERATED SUBSYSTEMS START - DO NOT DELETE
  // POWERLIB GENERATED SUBSYSTEMS END - DO NOT DELETE

  private RobotState wantedState = Constants.StateMachine.DEFAULT_STATE;
  private RobotState actualState = Constants.StateMachine.DEFAULT_STATE;

  public RobotState getWantedState() {
    return wantedState;
  }

  public void setWantedState(RobotState wantedState) {
    this.wantedState = wantedState;
  }

  /** Update this when the state controller actually transitions, independently of its demand. */
  public RobotState getActualState() { return actualState; }

  public void setActualState(RobotState actualState) {
    this.actualState = java.util.Objects.requireNonNull(actualState);
  }

  @Override
  public void periodic() {}
}
