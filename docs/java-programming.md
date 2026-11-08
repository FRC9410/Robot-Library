# Java programming

[Project README](../README.md) · [All guides](README.md)

Use this guide when adding robot behavior in Java or integrating PowerLib into an existing robot. If you are using the visual editor first, start with [Auto Builder](auto-builder.md).

Paths in code examples are relative to the robot project root. Source template paths in repository links are relative to Robot-Library.

- [Project structure](#project-structure)
- [Autonomous chooser](#autonomous-chooser)
- [Robot states](#robot-states)
- [Telemetry logging](#telemetry-logging)

## Project structure

### Library files

PowerLib files are added under `frc.powerlib`:

```text
src/main/java/frc/powerlib/PowerRobotContainer.java
src/main/java/frc/powerlib/auto/*.java
src/main/java/frc/powerlib/configs/*.java
src/main/java/frc/powerlib/math/*.java
src/main/java/frc/powerlib/subsystems/*.java
src/main/java/frc/powerlib/utils/*.java
src/main/java/frc/powerlib/vision/*.java
```

### Robot starter files

The release ZIP supplies these starter files. Extracting into a clean project replaces matching stock files directly:

```text
src/main/java/frc/robot/Constants.java
src/main/java/frc/robot/RobotContainer.java
src/main/java/frc/robot/autos/GeneratedAutos.java
src/main/java/frc/robot/autos/RobotAutos.java
src/main/java/frc/robot/commands/DriveToPose.java
src/main/java/frc/robot/commands/SwerveDriveCommand.java
src/main/java/frc/robot/constants/CanBusConstants.java
src/main/java/frc/robot/constants/LEDConstants.java
src/main/java/frc/robot/constants/LocationConstants.java
src/main/java/frc/robot/constants/OIConstants.java
src/main/java/frc/robot/constants/TunerConstants.java
src/main/java/frc/robot/constants/VisionConstants.java
src/main/java/frc/robot/subsystems/LED.java
src/main/java/frc/robot/subsystems/StateMachine.java
src/main/java/frc/robot/helpers/RobotChecks.java
src/main/java/frc/robot/subsystems/Swerve.java
src/main/java/frc/robot/subsystems/Vision.java
src/main/java/frc/robot/utils/FieldUtils.java
```

`RobotAutos.java` holds handwritten auto registrations. Power Tool writes generated
routines to `GeneratedAutos.java` when you explicitly save. Both files belong to your
robot project after initial setup; preserve them when reviewing a later release.

## Autonomous chooser

The starter `RobotContainer` publishes a standard autonomous dropdown at
`/SmartDashboard/Auto Chooser`. SmartDashboard and Elastic can use a String Chooser widget
for that table. The initial default is `None`.
Selection takes effect when `Robot.autonomousInit()` calls `getAutonomousCommand()`.
The library's `NTChooser` publishes options and reads selections directly through NetworkTables.
`AutoBuilder` updates the robot acknowledgement from its subsystem `periodic()` method.

### Registering routines

Register routines in `RobotAutos.register(AutoBuilder autoBuilder, StateMachine robot)`.
`RobotContainer.configureAutos()` calls it before `autoBuilder.publish()`. The starter
method is empty and includes commented examples of both waypoint styles below. Your
robot's coordinates and mechanism commands belong in this file.

```java
autoBuilder.addAuto("My Auto", () -> buildMyAuto(robot));
// Optional: register a different default instead of None.
autoBuilder.setDefaultAuto("Default Auto", () -> buildDefaultAuto(robot));
```

Optionally tag a routine with WPILib's `DriverStation.Alliance`:

```java
autoBuilder.addAuto("Red Auto", DriverStation.Alliance.Red, () -> buildRedAuto(robot));
autoBuilder.addAuto("Blue Auto", DriverStation.Alliance.Blue, () -> buildBlueAuto(robot));
// Without an alliance argument, a routine is available for either alliance.
autoBuilder.addAuto("Shared Auto", () -> buildSharedAuto(robot));
```

Import `edu.wpi.first.wpilibj.DriverStation` for this example. The chooser updates its
options when the reported alliance changes. While the alliance is unknown, only untagged
routines appear. `setDefaultAuto` also accepts an alliance argument; when that default is
unavailable, the chooser falls back to `None`. A selected routine that becomes unavailable
resolves to the available default. These tags filter routines; they do not mirror paths or
coordinates. Existing running commands continue unchanged.

### Drive commands and constraints

`frc.powerlib.auto.Auto` defines a routine using either direct destinations or a path
cursor. The starter `RobotContainer` configures its drive-command factory once:

```java
private final AutoBuilder autoBuilder =
    new AutoBuilder(pose -> new DriveToPose(stateMachine.drivetrain, pose));
```

`DriveToPose` uses blue-origin coordinates and `DriveConstraints(maxVelocity,
maxAcceleration, endDistanceTolerance, endVelocityTolerance)`. Defaults are 3 m/s,
3 m/s², 0.05 m, and 0.1 m/s. A leg finishes when both position and measured speed
are inside their tolerances. Heading completion is optional via
`withHeadingTolerance(Rotation2d.fromDegrees(10))`. The command owns the
drivetrain and stops translation and rotation when it completes or is interrupted.
It never seeds the starting pose or flips coordinates for an alliance.

Use `new DriveToPose(drivetrain, pose, constraints)` in an `addCommand()` factory for
per-leg limits. Every leg starts from measured velocity, including gradual deceleration
when its new speed limit is lower. Looser distance and velocity tolerances let the next
leg round a corner. `atProgress(fraction, action)` runs an action once at the requested
fraction of the straight-line leg. Normal completion runs any remaining progress actions;
cancellation does not. `turningAfter(fraction)` delays turning, `facing(fieldPoint)` aims
at a field point, and `withMaxTurnRate(radiansPerSecond)` limits turning speed. Without
an override, the drivetrain's tuned drive-to-point angular rate is used.

You can supply your own factory returning fresh commands instead. The builder sequences
them without choosing timeouts, starting poses, or coordinate transformations.

### Direct points and path cursors

Both definitions below execute the same steps. `pickupPoint` and `shootingPoint` are
`Pose2d` destinations; the command methods are factories for your robot's actions.

```java
autoBuilder.addAuto(new frc.powerlib.auto.Auto("Blue direct")
    .withAlliance(DriverStation.Alliance.Blue)
    .addCommand(() -> buildIntakeCommand(robot))
    .addDriveToPoint(pickupPoint)
    .addCommand(() -> buildSpinUpCommand(robot))
    .addDriveToPoint(shootingPoint)
    .addCommand(() -> buildShootCommand(robot)));

autoBuilder.addAuto(new frc.powerlib.auto.Auto("Blue path")
    .withAlliance(DriverStation.Alliance.Blue)
    .withPath(new Pose2d[] {pickupPoint, shootingPoint})
    .addCommand(() -> buildIntakeCommand(robot))
    .toNextPoint()
    .addCommand(() -> buildSpinUpCommand(robot))
    .toNextPoint()
    .addCommand(() -> buildShootCommand(robot)));
```

Import `edu.wpi.first.math.geometry.Pose2d` for this example. `withPath()` stores a copy
of the destination list and adds no drive steps. Each `toNextPoint()` appends the next
destination. `addDriveToPoint()` leaves that cursor unchanged, so the styles can also be
mixed. All defined path points must be consumed before registering/building the auto
or replacing its path. An exhausted cursor or invalid destination fails during definition
with the auto's name. Consecutive destinations run as separate drive commands; this API
does not smooth them into a continuous trajectory.

Commands run in order and the next step waits for the active command to finish. Instant
state requests advance immediately while the requested state remains active. Mechanism
commands are responsible for the lifetime and cleanup of their owned state requests.
Cancellation interrupts the active command and leaves later steps unstarted.

`addCommand()` accepts `Supplier<Command>` so each autonomous run gets fresh commands.
The chooser captures the definition when it is registered; later edits to that `Auto`
do not change the registered routine. `setDefaultAuto(auto)` accepts the same definition.
For standalone use, `auto.build(this::driveToPoint)` creates a fresh command sequence;
command-only definitions also support `auto.build()`. Existing factory registration
and `CommandBuilder` remain supported.

### Command factories and cleanup

Factories must return fresh commands, including the children of command groups. The reusable
`frc.powerlib.auto.CommandBuilder` can assemble sequences from factories:

```java
private static Command buildMyAuto(StateMachine robot) {
  Object owner = new Object();
  return new frc.powerlib.auto.CommandBuilder()
      .runOnce(() -> robot.requestState(StateMachine.RobotState.IDLE, owner), robot)
      .waitSeconds(0.5)
      .command(() -> new com.pathplanner.lib.commands.PathPlannerAuto("My Path"))
      .build().finallyDo(() -> robot.clearRequest(owner));
}
```

Use your own actions or driving commands in each step. PathPlanner routines require their
matching deployed auto/path files. The chooser handles missing or stale selections by using
the configured default. Dashboard widgets write `selected` and read the robot's `active`
acknowledgement. Changing the selection does not change an already running routine.

For an existing robot, compare the release’s starter `RobotContainer.java` with your
container. Integrate its `autoBuilder` field, `configureAutos()` call/method, and
`getAutonomousCommand()` implementation as needed. Keep registrations in
`RobotAutos.register()` and call it before publishing the chooser.

## Robot states

The PowerLib `frc.powerlib.statemachine.State<R, M>` contract requires
`match(requestedState, stateMachine)` and `execute(requestedState, stateMachine)`.
Robot handlers live under `frc.robot.subsystems.states`; the starter handler is
`states.IdleState`.

`requestState(state, owner)` stores one request per owner; another request from that
owner replaces its entry. `clearRequest(owner)` removes only that entry. The state
machine scans handlers in registration order and checks each owner's request against
each handler. The first matching handler wins, so the `states` list defines priority
across all requests. Empty requests use `Constants.StateMachine.DEFAULT_STATE`.

`StateMachine.periodic()` calls each handler's optional `prepare(stateMachine)` once,
resolves the winning request, then executes its handler. Preparation keeps state-owned
inputs fresh even when selection is skipped; it should not command hardware.
Handlers can also override `reset()` to clear their internal behavior on mode changes;
robot mode-reset code must call it on the registered handlers.
`getWantedState()` reports that resolved request. A single unchanged request skips
selection when requested and current state agree. Multiple requests are checked each
cycle so a higher-priority request whose guard becomes ready can take over. When no
handler matches, the current handler continues and the request stays pending. Each
handler reports its actual state with `setActualState()`.

Use `new RequestState(RobotState.IDLE, owner, stateMachine)` in an autonomous sequence.
This instant command registers the request and finishes without waiting for the
transition. Use a stable owner for related requests and clear it when the routine ends.
Idle currently only reports `IDLE`; add robot-specific idle outputs to its `execute()`.

### Controller bindings

`frc.powerlib.controls.ButtonBindings` provides two press/release helpers:

```java
ButtonBindings.bindFunctions(button, onPress, onRelease);
ButtonBindings.bindStates(button, pressState, releaseState, stateMachine::requestState);
```

The state helper creates a stable owner per binding. Releasing one button updates only
its own request, preserving other held buttons. For example, requesting `IDLE` on release
allows a higher-priority held request to continue. The function helper also accepts
optional subsystem requirements for actions that need command ownership.

For a press-only action, use `ButtonBindings.bindFunctions(button, onPress, runWhenDisabled)`.
Setting the last argument to `true` permits the action while disabled; enforce any
disabled-only restriction inside the action itself.

`getCurrentState()` returns the current robot state; `getActualState()` exposes the same
value for dashboard telemetry. The drive command receives `stateMachine::getCurrentState`
as a supplier, so its `getCurrentState()` reads live state whenever drive logic needs it.
Changing the request alone does not change this value.

### Health check helpers

`frc.powerlib.health.HealthChecks` shares finite-pose, timestamp freshness, CTRE signal,
mechanism configuration/feedback, and Phoenix drivetrain checks. Callers supply the
maximum signal age. Drivetrain checks support CANcoder modules. Simulation checks retain
configuration and pose validation while bypassing physical CAN connection requirements.
Choose the mechanisms required for a particular action in your robot code; the helper
does not depend on robot states or shooting settings.

## Telemetry logging

Subsystems continuously store their latest values through `PowerRobotContainer.setData()`
or `setSubsystemData()`. `PowerDashboard` calls `SubsystemTelemetry` every 20 ms robot loop.
Logging reads the latest map at 50 Hz. Every 100 ms, the network publisher captures the complete grouped data map and publishes one JSON value at `/PowerLib/Data`.
The frame contains `schemaVersion: 1`, an increasing `sequence`, `timestampSeconds`, and
`subsystems` (the full subsystem-to-metric map). Removed metrics and subsystems disappear
from the next frame. Nonfinite numbers become JSON null, so invalid feedback and inactive
heading targets cannot retain a previous value on the dashboard.

Power Tool replaces its telemetry from each valid complete frame, preserving the actual
arrival timestamp. It retains only the latest frame between 100 ms screen refreshes. The
dashboard derives its existing per-field views locally; those scalar topics are no longer
individually published by the robot. Other NetworkTables topics, including tuning,
characterization and the autonomous chooser, keep their own protocols. Older robot
per-field telemetry remains readable until a complete-object publisher appears.

`DriveTelemetry` includes requested/actual state, battery, enabled/mode, alliance, match
time, CAN utilization, X/Y/heading, an optional heading target, pose validity and heartbeat.
Its `Pose` is a `Pose2d` in the data map and is encoded in JSON as `xMeters`, `yMeters`
and `headingRadians`. For AdvantageScope simulation and field/heatmap analysis, the same
captured pose is also published as a typed struct at
`/PowerLib/Subsystems/Drive/Data/Pose`. This compatibility topic uses the same publishing
cycle and does not collect pose separately. Missing/invalid pose is null in the frame;
the struct receives no fabricated pose samples.

The latest map is logged every 20 ms (50 Hz) through CTRE SignalLogger under
`PowerLib/Subsystems/<name>/Data/<key>`; Pose keeps its typed struct/schema. Numeric values
can include units through the optional final argument to `setSubsystemData`. Boolean,
numeric and string values retain their types; unsupported objects use their string value.
Log recording follows Phoenix's logger start/stop behavior. SysId hooks remain separate.

`RobotLogTelemetry` writes autonomous status/reason, DS/FMS/controller connection and
brownout directly to SignalLogger every 20 ms (50 Hz) under `PowerLib/RobotStatus/<key>`. Those
fields bypass shared data and NetworkTables. Alliance, time and CAN utilization stay in
the dashboard map and its ordinary log path, without duplicate logging.

Built-in mechanism telemetry omits applied voltage and connection status. Robot control
and feedback checks continue at the normal loop rate. Update existing customized
`PowerDashboard` integrations to use the shared writer and the separate status logger.

For reviewing recorded data in Power Tool, see [Log Viewer](log-viewer.md). Vision filtering and estimator integration are documented in [Vision](vision.md).
