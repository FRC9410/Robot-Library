package frc.powerlib.statemachine;

/** A robot state handler, independent of the robot's state enum and subsystem types. */
public interface State<R extends Enum<R>, M> {
  /** Returns whether this handler can run for the request and current robot conditions. */
  boolean match(R requestedState, M stateMachine);

  /** Runs each robot cycle while active; reports actual state through the state machine. */
  void execute(R requestedState, M stateMachine);
}
