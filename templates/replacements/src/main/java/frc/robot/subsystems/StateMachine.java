// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.statemachine.State;
import frc.powerlib.subsystems.AbsolutePositionSubsystem;
import frc.powerlib.subsystems.RelativePositionSubsystem;
import frc.powerlib.subsystems.VelocitySubsystem;
import frc.powerlib.subsystems.VelocityTorqueSubsystem;
import frc.robot.Constants;
import frc.robot.subsystems.states.idle.IdleState;
import java.util.List;
import java.util.Objects;

public class StateMachine extends SubsystemBase {
  public enum RobotState {
    IDLE
  }

  public final Swerve drivetrain = Constants.Tuner.createDrivetrain();
  public final Vision vision = new Vision(drivetrain);

  // POWERLIB GENERATED SUBSYSTEMS START - DO NOT DELETE
  // POWERLIB GENERATED SUBSYSTEMS END - DO NOT DELETE

  private RobotState wantedState = Constants.StateMachine.DEFAULT_STATE;
  private RobotState currentState = Constants.StateMachine.DEFAULT_STATE;
  // Registration order is priority: the first matching handler wins.
  private final List<State<RobotState, StateMachine>> states = List.of(new IdleState());
  private State<RobotState, StateMachine> activeState = states.get(0);

  public RobotState getWantedState() {
    return wantedState;
  }

  public void setWantedState(RobotState wantedState) {
    this.wantedState = Objects.requireNonNull(wantedState);
  }

  public RobotState getCurrentState() {
    return currentState;
  }

  /** The dashboard's actual state is the same state exposed to robot commands. */
  public RobotState getActualState() { return getCurrentState(); }

  public void setActualState(RobotState actualState) {
    this.currentState = Objects.requireNonNull(actualState);
  }

  public void execute() {
    selectState();
    activeState.execute(wantedState, this);
  }

  private void selectState() {
    if (wantedState == currentState) {
      return;
    }

    for (State<RobotState, StateMachine> state : states) {
      if (state.match(wantedState, this)) {
        activeState = state;
        return;
      }
    }
    // Keep running the current state until a handler can accept the request.
  }

  @Override
  public void periodic() {
    execute();
  }
}
