---
title: Robot Lifecycle
date: 2026-10-30
tags: [guide, lifecycle, state-machine]
---

# Robot Lifecycle

What runs when, from power-on through each match mode.

> [!NOTE]
> Robot-Library does **not** install `Robot.java`. Your project keeps the stock WPILib
> command-based `Robot.java` (the MapleSim skill adds simulation hooks to it). The behavior below
> assumes that stock file; check yours.

## Startup (constructing `RobotContainer`)
Fields are created in this order:
1. **`StateMachine`**, which creates:
   - `Swerve` via `Constants.Tuner.createDrivetrain()`;
   - `Vision(drivetrain)`;
   - each generated mechanism. Startup CTRE config runs here (50 ms timeouts). Absolute mechanisms move to their default position, using the CANcoder's real angle.
     - **Relative mechanisms don't search for home.** They declare the encoder's current reading to *be* `homePosition` and hold that coordinate. Wherever the mechanism physically sits at boot becomes "home", so boot it at home.
2. **`PowerDashboard(stateMachine)`:** registers `@TunableConstant` classes (`GeneratedTunableConstants.register()`) and sets up drive and log telemetry.
3. **Driver controller**, then **`AutoBuilder`**.

Then the constructor:
- runs `configureBindings()`;
- sets `SwerveDriveCommand` as the drivetrain's default command;
- runs `configureAutos()` (`RobotAutos.register`, then `autoBuilder.publish()`).

The thread that first touches the shared data store (the main robot thread) becomes its owner.
Any other thread that touches it throws, including the 5 ms Swerve sim notifier.

## Every 20 ms loop, in every mode, including disabled
The stock `Robot.robotPeriodic()` runs `CommandScheduler.run()`, which calls every subsystem's `periodic()`:
- **`StateMachine.periodic()`:** `prepare()` on every handler, select a handler, then `execute()` the active one. **This also runs while disabled.** Handlers may issue commands then, but the motors stay disabled.
- **Mechanisms:** read inputs, apply tuning if enabled, publish data.
- **`Vision`:** read cameras, apply heading/pose rules for the current mode (see "Behavior by mode" in [Vision Pipeline](../03-PowerLib/Vision%20Pipeline.md)).
- **`PowerDashboard`:** telemetry (log every loop, NT every 100 ms) and the tuning sync.
- **`AutoBuilder`:** refresh the alliance-filtered options and publish `active`.

## Mode by mode
| Mode | What happens | Watch out for |
|---|---|---|
| **Disabled** | Outputs off. Telemetry, tuning and vision keep running. Vision can initialize heading from MT1 and accept single-tag fallback. Power Tool allows auto selection only now. | State requests made earlier are **still stored** |
| **Autonomous** | Stock `autonomousInit()` calls `getAutonomousCommand()`, which builds **fresh** commands from the selected routine, and schedules them. `DriveTelemetry` reports `AUTO`. | Requests made with `RequestState` stay until cleared; clear them in `finallyDo` |
| **Teleop** | Stock `teleopInit()` cancels the auto command. Cancellation **interrupts** the active step; later steps never start. Default drive command runs. | `finallyDo(() -> robot.clearRequest(owner))` runs on interrupt; requests without it linger |
| **Test** | Stock `testInit()` cancels all commands. Vision **suppresses heading initialization, recovery and correction**; position fusion continues if heading was established. `Mode` = `TEST`; Power Tool hides the heading setpoint. | Handlers still execute |

## Things the template does *not* do for you
1. **Clear state requests on mode changes.** Requests are stored per owner until that owner calls `clearRequest` (or asks for another state). A held-button or auto request can carry across modes.
2. **Call `State.reset()`.** The interface provides it, but nothing calls it, and the `states` list is private. If your handlers keep internal timers or flags, add a method to `StateMachine` and call it from `Robot.disabledInit()`/`autonomousInit()`/`teleopInit()`:
   ```java
   /** Clears handler-owned behavior; optionally drops all pending requests. */
   public void resetForModeChange(boolean clearRequests) {
     if (clearRequests) { requests.clear(); requestsChanged = true; }
     for (State<RobotState, StateMachine> state : states) state.reset();
   }
   ```
   Clearing requests also drops held-button requests until that button's next edge, so decide per team.
3. **Start SignalLogger at a known path.** Phoenix defaults apply. See [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md).
4. **Choose a handler on the very first loop.** `activeState` starts as the first handler in the list, and the first loop skips choosing. That's fine as shipped, because Idle is the only handler. If you list another handler before Idle, also set `private boolean requestsChanged = true;`, or that handler runs at boot. See step 4 of [Adding a Robot State](Adding%20a%20Robot%20State.md).

## Autonomous cleanup pattern
```java
Object owner = new Object();
return new CommandBuilder()
    .runOnce(() -> robot.requestState(RobotState.INTAKING, owner), robot)
    .waitSeconds(1.0)
    .build()
    .finallyDo(() -> robot.clearRequest(owner)); // runs on finish AND on interrupt
```

Related: [State Machine and Controls](../03-PowerLib/State%20Machine%20and%20Controls.md), [Adding a Robot State](Adding%20a%20Robot%20State.md), [Autonomous](../03-PowerLib/Autonomous.md), [Robot Templates](../04-Robot-Templates/Robot%20Templates.md)
