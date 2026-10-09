package frc.robot.subsystems.states.idle;

import frc.powerlib.statemachine.State;
import frc.robot.subsystems.StateMachine;
import frc.robot.subsystems.StateMachine.RobotState;

public class IdleState implements State<RobotState, StateMachine> {
  @Override
  public boolean match(RobotState requestedState, StateMachine stateMachine) {
    return requestedState == RobotState.IDLE;
  }

  @Override
  public void execute(RobotState requestedState, StateMachine stateMachine) {
    stateMachine.setActualState(RobotState.IDLE);
  }
}
