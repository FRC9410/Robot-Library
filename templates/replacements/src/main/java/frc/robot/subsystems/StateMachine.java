// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.Constants;

public class StateMachine extends SubsystemBase {
  public enum RobotState {
    IDLE
  }

  public final LED led = new LED();
  public final Vision vision = new Vision();
  public final Swerve drivetrain = Constants.Tuner.createDrivetrain();

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


