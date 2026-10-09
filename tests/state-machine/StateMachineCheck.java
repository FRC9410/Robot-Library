package frc.robot.subsystems;

import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import frc.powerlib.statemachine.State;
import frc.robot.commands.RequestState;
import frc.robot.commands.SwerveDriveCommand;
import frc.robot.subsystems.StateMachine.RobotState;
import frc.robot.subsystems.states.IdleState;
import java.lang.reflect.Field;
import java.util.List;

/** Runs the installed template logic with a test-only CHECK state and no motor hardware. */
public class StateMachineCheck {
  private static class RecordingState implements State<RobotState, StateMachine> {
    int matches;
    int executions;
    int preparations;
    boolean ready;
    RobotState lastRequest;
    StateMachine lastMachine;

    RecordingState(boolean ready) { this.ready = ready; }

    public void prepare(StateMachine machine) { preparations++; }

    public boolean match(RobotState request, StateMachine machine) {
      matches++;
      return ready && request == RobotState.CHECK;
    }

    public void execute(RobotState request, StateMachine machine) {
      executions++;
      lastRequest = request;
      lastMachine = machine;
      machine.setActualState(RobotState.CHECK);
    }
  }

  private static void check(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }

  public static void main(String[] args) throws Exception {
    check(HAL.initialize(500, 0), "HAL initialization");
    StateMachine machine = new StateMachine();
    Object owner = new Object();
    SwerveDriveCommand drive = new SwerveDriveCommand(
        machine.drivetrain, new CommandXboxController(0), machine::getCurrentState);
    check(drive.getCurrentState() == RobotState.IDLE, "Drive starts with current Idle state");
    IdleState idle = new IdleState();
    check(idle.match(RobotState.IDLE, machine), "Idle matches IDLE");
    check(!idle.match(RobotState.CHECK, machine), "Idle rejects other requests");

    RecordingState blocked = new RecordingState(false);
    RecordingState first = new RecordingState(true);
    RecordingState later = new RecordingState(true);
    Field states = StateMachine.class.getDeclaredField("states");
    states.setAccessible(true);
    states.set(machine, List.of(blocked, first, later, idle));

    RequestState command = new RequestState(RobotState.CHECK, owner, machine);
    check(command.getRequirements().contains(machine), "Command requires state machine");
    command.initialize();
    check(command.isFinished(), "Request command finishes immediately");
    check(machine.hasRequest(RobotState.CHECK), "Command registers owned request");
    check(machine.getActualState() == RobotState.IDLE, "Request does not change actual state");
    check(drive.getCurrentState() == RobotState.IDLE, "Drive sees current state while request is pending");

    machine.periodic();
    check(blocked.matches == 1 && first.matches == 1 && later.matches == 0,
        "Search checks priority order and stops at first match");
    check(blocked.executions == 0 && first.executions == 1 && later.executions == 0,
        "Only matching handler executes");
    check(first.lastRequest == RobotState.CHECK && first.lastMachine == machine,
        "Execute receives requested state and this machine");
    check(machine.getActualState() == RobotState.CHECK, "Handler reports actual state");
    check(machine.getCurrentState() == machine.getActualState(), "Current and actual state share one value");
    check(drive.getCurrentState() == RobotState.CHECK, "Drive supplier sees transition without recreating command");

    machine.periodic();
    check(blocked.matches == 1 && first.matches == 1 && later.matches == 0,
        "Already in requested state skips search");
    check(first.executions == 2, "Active handler continues executing without a search");
    check(blocked.preparations == 2 && first.preparations == 2 && later.preparations == 2,
        "State inputs refresh once per cycle even when the selection search is skipped");

    new RequestState(RobotState.IDLE, owner, machine).initialize();
    machine.periodic();
    check(machine.getActualState() == RobotState.IDLE, "Can return to Idle");
    check(drive.getCurrentState() == RobotState.IDLE, "Drive sees return to Idle");

    first.ready = false;
    later.ready = false;
    new RequestState(RobotState.CHECK, owner, machine).initialize();
    machine.periodic();
    check(machine.getWantedState() == RobotState.CHECK && machine.getActualState() == RobotState.IDLE,
        "Unmatched request stays pending while Idle remains active");
    int attempts = first.matches;
    machine.periodic();
    check(first.matches == attempts + 1, "Pending request retries search next cycle");
    first.ready = true;
    machine.periodic();
    check(machine.getActualState() == RobotState.CHECK, "Transition waits until match condition allows it");

    try {
      machine.requestState(null, owner);
      throw new AssertionError("Null request accepted");
    } catch (NullPointerException expected) { }

    try {
      machine.requestState(RobotState.IDLE, null);
      throw new AssertionError("Null owner accepted");
    } catch (NullPointerException expected) { }

    Object otherOwner = new Object();
    machine.requestState(RobotState.IDLE, otherOwner);
    machine.periodic();
    check(machine.getCurrentState() == RobotState.CHECK, "Another owner's Idle cannot cancel CHECK");
    states.set(machine, List.of(idle, first));
    machine.periodic();
    check(machine.getCurrentState() == RobotState.IDLE, "Handler order determines request priority");
    states.set(machine, List.of(first, idle));
    machine.periodic();
    check(machine.getCurrentState() == RobotState.CHECK, "Changing order changes the winner");
    machine.clearRequest(owner);
    machine.periodic();
    check(machine.getCurrentState() == RobotState.IDLE, "Clearing one owner preserves the other's request");
    machine.clearRequest(otherOwner);
    machine.periodic();
    check(machine.getWantedState() == RobotState.IDLE, "Empty requests fall back to default state");

    System.out.println("State machine checks passed: owned requests, handler priority, guards, pending requests and RequestState.");
  }
}
