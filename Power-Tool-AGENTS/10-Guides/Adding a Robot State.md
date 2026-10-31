---
title: Adding a Robot State
date: 2026-10-30
tags: [guide, state-machine, example]
---

# Adding a Robot State

A complete `INTAKING` state for the `IntakeRoller` mechanism from the
[First Robot Walkthrough](First%20Robot%20Walkthrough.md). It covers each part: enum, handler,
priority, readiness guard, commanding the mechanism, reporting actual state, and clearing the request.

## 1. Add the enum value
`src/main/java/frc/robot/subsystems/StateMachine.java`:
```java
public enum RobotState {
  IDLE,
  INTAKING
}
```

## 2. Add a constant for the speed
The first Update Code imported `IntakeRollerConstants`' custom block into
`power-tool/generated/powerlib-constants.json`. From then on, **the JSON rebuilds that block on every
Update Code**, so a line added only in Java disappears. Add the row to the JSON instead (Power
Tool's drawer edits existing values but doesn't add constants):
```json
"subsystem:intakeRoller": {
  "constants": [
    { "name": "INTAKE_SPEED_RPS", "type": "double", "value": "40.0", "custom": true, "tunable": true }
  ]
}
```
Run **Update Code**. The custom block now contains:
```java
  // POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE
  @frc.powerlib.tuning.TunableConstant public static volatile double INTAKE_SPEED_RPS = 40.0;
  // POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE
```
It's live-tunable as `IntakeRoller/Variables/Custom/INTAKE_SPEED_RPS`. Read it **each loop**
(not once in a constructor) so live edits take effect. Rules:
[File Ownership and Precedence](File%20Ownership%20and%20Precedence.md).

## 3. Write the handler
`src/main/java/frc/robot/subsystems/states/IntakingState.java`:
```java
package frc.robot.subsystems.states;

import frc.powerlib.statemachine.State;
import frc.robot.Constants;
import frc.robot.subsystems.StateMachine;
import frc.robot.subsystems.StateMachine.RobotState;

public class IntakingState implements State<RobotState, StateMachine> {
  @Override
  public boolean match(RobotState requested, StateMachine machine) {
    // Readiness guard: refuse while the intake failed startup config.
    // A refused request stays pending and the current handler keeps running.
    return requested == RobotState.INTAKING && machine.intakeRoller.isConfigured();
  }

  @Override
  public void execute(RobotState requested, StateMachine machine) {
    machine.intakeRoller.setVelocity(Constants.IntakeRoller.INTAKE_SPEED_RPS);
    machine.setActualState(RobotState.INTAKING); // report what the robot is actually doing
  }
}
```

Make **Idle stop the roller**. Otherwise it keeps spinning after you leave `INTAKING`:
```java
// IdleState.execute
machine.intakeRoller.stopVelocity();
machine.setActualState(RobotState.IDLE);
```

## 4. Register it and choose priority
In `StateMachine.java`, list order is priority: the first handler that matches **any** current
request wins.
```java
private final List<State<RobotState, StateMachine>> states =
    List.of(new IntakingState(), new IdleState());
```
With `IntakingState` first, one owner requesting `INTAKING` beats another owner requesting `IDLE`.
Put safety or override states (e.g. `CLIMBING`) earliest.

**Also change this line in `StateMachine.java` whenever Idle is no longer first in the list:**
```java
private boolean requestsChanged = true; // template has: private boolean requestsChanged;
```

Why:
- The template starts with `activeState = states.get(0)`, the first handler in the list.
- On the robot's very first loop there are no requests, and requested and current state are both `IDLE`. So the state machine skips choosing a handler and runs `states.get(0)`.
- In the shipped template that's `IdleState`, which is correct. Once `IntakingState` is first, the first loop would run it instead: the roller is commanded to 40 rps, and the state reads `INTAKING` with nobody asking.
- Setting `requestsChanged = true` makes the first loop choose properly. With no requests, it picks the handler that matches `DEFAULT_STATE` (`IdleState`), whatever the list order.

## 5. Request it
**Button (hold to intake):** in `RobotContainer.configureBindings()`:
```java
ButtonBindings.bindStates(
    driverController.rightBumper(), RobotState.INTAKING, RobotState.IDLE, stateMachine::requestState);
```
Each binding has its own owner. Release replaces that owner's request with `IDLE`, and other
buttons' requests are unaffected.

**Autonomous:** request, then always clear:
```java
Object owner = new Object();
autoBuilder.addAuto("Intake test", () -> new CommandBuilder()
    .runOnce(() -> robot.requestState(RobotState.INTAKING, owner), robot)
    .waitSeconds(2.0)
    .build()
    .finallyDo(() -> robot.clearRequest(owner)));
```

## 6. Check it
- **Power Tool Drive tab:** `RequestedState` goes to `INTAKING` when you press the button. `ActualState` follows only when the handler runs. If the guard refuses, Requested shows INTAKING while Actual stays IDLE.
- **Robot tab:** `IntakeRoller` `VelocitySetpoint` = 40 and Velocity tracks it.
- **Offline:** `tests/state-machine-check.ps1` shows how the template's selection rules are tested.

Related: [State Machine and Controls](../03-PowerLib/State%20Machine%20and%20Controls.md), [Robot Lifecycle](Robot%20Lifecycle.md), [Mechanism Behavior](../03-PowerLib/Mechanism%20Behavior.md), [Autonomous](../03-PowerLib/Autonomous.md)
