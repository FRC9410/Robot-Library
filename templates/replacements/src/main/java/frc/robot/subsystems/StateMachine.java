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
import frc.robot.subsystems.states.IdleState;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
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
  private final Map<Object, RobotState> requests = new LinkedHashMap<>();
  private boolean requestsChanged;
  // Registration order is priority: the first matching handler wins.
  private final List<State<RobotState, StateMachine>> states = List.of(new IdleState());
  private State<RobotState, StateMachine> activeState = states.get(0);

  public RobotState getWantedState() {
    return wantedState;
  }

  /** Replaces only this owner's request. Handler order decides which request wins. */
  public void requestState(RobotState requestedState, Object owner) {
    Objects.requireNonNull(requestedState);
    Objects.requireNonNull(owner);
    requestsChanged |= requests.put(owner, requestedState) != requestedState;
  }

  public void clearRequest(Object owner) {
    requestsChanged |= requests.remove(Objects.requireNonNull(owner)) != null;
  }

  public boolean hasRequest(RobotState requestedState) {
    return requests.containsValue(requestedState);
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
    for (State<RobotState, StateMachine> state : states) state.prepare(this);
    selectState();
    activeState.execute(wantedState, this);
  }

  private void selectState() {
    // A new request may outrank the current state. Multiple requests can have changing guards.
    if (!requestsChanged && requests.size() <= 1 && wantedState == currentState) {
      return;
    }
    requestsChanged = false;

    for (State<RobotState, StateMachine> state : states) {
      for (RobotState request : requests.values()) {
        if (state.match(request, this)) {
          wantedState = request;
          activeState = state;
          return;
        }
      }
      if (requests.isEmpty() && state.match(Constants.StateMachine.DEFAULT_STATE, this)) {
        wantedState = Constants.StateMachine.DEFAULT_STATE;
        activeState = state;
        return;
      }
    }
    if (!requests.isEmpty()) wantedState = requests.values().iterator().next();
    // Keep running the current state until a handler can accept the request.
  }

  @Override
  public void periodic() {
    execute();
  }
}
