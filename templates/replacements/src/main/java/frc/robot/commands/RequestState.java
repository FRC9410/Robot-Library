package frc.robot.commands;

import edu.wpi.first.wpilibj2.command.InstantCommand;
import frc.robot.subsystems.StateMachine;
import frc.robot.subsystems.StateMachine.RobotState;
import java.util.Objects;

/** Requests a state once; the state machine decides when the robot can enter it. */
public class RequestState extends InstantCommand {
  public RequestState(RobotState requestedState, Object owner, StateMachine stateMachine) {
    super(() -> stateMachine.requestState(requestedState, owner), stateMachine);
    Objects.requireNonNull(requestedState);
    Objects.requireNonNull(owner);
    Objects.requireNonNull(stateMachine);
  }
}
