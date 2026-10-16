# Robot-Library

Team 9410 one-time installer for starting a new WPILib Java robot project.

Run the installer from the root of a newly-created robot project. It uses that project's Gradle wrapper, so Gradle does not need to be installed globally.

## Install

Windows:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.ps1" -OutFile ".robot-library-install.ps1"
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1
```

To install from a branch or tag, pass the same Git ref to the installer:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/feature/maple-sim-integration/install.ps1" -OutFile ".robot-library-install.ps1"
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1 -RepoRef "feature/maple-sim-integration"
```

macOS / Linux:

```bash
curl -fsSL "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.ps1" -o ".robot-library-install.ps1"
pwsh -ExecutionPolicy Bypass -File ./.robot-library-install.ps1
```

The installer asks which sections to install:

```text
PowerLib install (library files, robot templates, and skills)
vendor dependencies
Power Tool source, npm dependencies, and scripts
```

## Added Library Files

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

## Added / Replaced Robot Files

These robot starter/template files are written into the robot project. On the first install, existing stock files are backed up before replacement. On later installs, existing robot template files are preserved and the updated template is written beside them with a `.template` suffix, such as `RobotContainer.java.template`.

```text
src/main/java/frc/robot/Constants.java
src/main/java/frc/robot/RobotContainer.java
src/main/java/frc/robot/autos/RobotAutos.java
src/main/java/frc/robot/commands/SwerveDriveCommand.java
src/main/java/frc/robot/constants/CanBusConstants.java
src/main/java/frc/robot/constants/LEDConstants.java
src/main/java/frc/robot/constants/LocationConstants.java
src/main/java/frc/robot/constants/OIConstants.java
src/main/java/frc/robot/constants/TunerConstants.java
src/main/java/frc/robot/constants/VisionConstants.java
src/main/java/frc/robot/subsystems/LED.java
src/main/java/frc/robot/subsystems/StateMachine.java
src/main/java/frc/robot/subsystems/Swerve.java
src/main/java/frc/robot/subsystems/Vision.java
src/main/java/frc/robot/utils/FieldUtils.java
```

The installer creates temporary backups before replacing files. Successful installs delete those backups by default.

`RobotAutos.java` is created only when missing. Existing robot autos are preserved on
every install, including the first, without creating a `.template` copy for this file.

## Autonomous Chooser

The starter `RobotContainer` publishes a standard autonomous dropdown at
`/SmartDashboard/Auto Chooser`. SmartDashboard and Elastic can use a String Chooser widget
for that table. The initial default is `None`.
Selection takes effect when `Robot.autonomousInit()` calls `getAutonomousCommand()`.
The library's `NTChooser` publishes options and reads selections directly through NetworkTables.
`AutoBuilder` updates the robot acknowledgement from its subsystem `periodic()` method.

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

`frc.powerlib.auto.Auto` defines a routine using either direct destinations or a path
cursor. Configure `AutoBuilder` with your robot's drive-command factory once:

```java
private final AutoBuilder autoBuilder = new AutoBuilder(this::driveToPoint);
```

`driveToPoint(Pose2d destination)` is a robot-provided method returning a fresh command
that requires the drivetrain, finishes when the destination is reached, and stops its
outputs in `end()`. The builder sequences these commands; it does not choose a motion
controller, arrival tolerance, timeout, starting pose, or coordinate transformation.

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

Existing installations receive `RobotContainer.java.template`; adopt its `autoBuilder`
field, `configureAutos()` call/method, and `getAutonomousCommand()` implementation in your
robot container. Move registrations into `RobotAutos.register()` and call it before
publishing the chooser. Updating PowerLib alone preserves your existing robot container.

## Autonomous motion constraints

`MotionConstraints` defines positive, finite ceilings for translation speed (m/s), translation
acceleration (m/s²), angular speed (rad/s), and angular acceleration (rad/s²). It has no
robot-specific defaults. `ChassisMotionLimiter` applies these limits to chassis-speed requests;
it limits the magnitude of the translation vector and its change, including changes of direction.
Acceleration and deceleration use the same limit. Rotation is limited independently.

Each active driving command owns its limiter. Call `reset(measuredSpeeds)` on initialization,
then `calculate(desiredSpeeds, elapsedSeconds)` on each update. All speeds must use the same
fixed coordinate frame. For field-relative commands, convert measured robot-relative speeds
with `ChassisSpeeds.fromRobotRelativeSpeeds(measuredSpeeds, currentHeading)` before resetting.
Reset clamps initially excessive speeds to the velocity ceilings; hard ceilings take precedence
over acceleration limiting at that boundary. Zero elapsed time holds the previous request;
negative/nonfinite elapsed time and nonfinite speeds throw without changing accepted state.
The returned `ChassisSpeeds` is independent of the limiter's internal history.

These are command limits, not measured-acceleration or module-speed guarantees. The limiter
does not add waypoint handoffs, plan braking from remaining path distance, or change command
completion criteria. The caller retains immediate cancellation/fault stops outside the limiter.
Use robot measurements to choose limits and validate endpoint settling and timeouts.

The Swerve template provides `resetAutonomousHeadingController()` and
`calculateAutonomousHeadingRate(currentHeading, targetHeading)`. The separate 20 ms autonomous
PID shares configured heading gains and angle wrapping while keeping manual facing-angle history
separate. Apply its omega through the limiter before submitting the drive request; using the
ordinary facing-angle request would calculate rotation after the limiter. These helpers do not
automatically change existing driving commands or teleop behavior.

## Remaining-path distance control

`PathDistance` stores an immutable list of translation destinations ending at one intended stop.
It caches the distance after each destination during construction. Call
`remainingDistance(currentPosition, activeDestinationIndex)` for the distance from the current
position to that target plus all subsequent segment lengths. Each update takes constant work
and does not allocate a new path. Repeated points are allowed. Empty paths, invalid indices,
nonfinite positions, and unrepresentable distances are rejected.

The caller owns the active index. The calculator does not advance waypoints, choose the nearest
segment, or force progress to increase. Movement away from the active target or a vision pose
correction can increase the distance. It measures travel via that target, rather than projection
onto the segment or a shortcut to the final point. Waypoint handoffs remain a separate behavior.

`DistanceSpeedController` owns a supplied `PIDController` and a positive feedforward threshold in
meters. `calculate(remainingDistanceMeters, staticFeedforwardMetersPerSecond)` retains the existing
unsigned PID-magnitude response and adds feedforward at or above the threshold. Supply feedforward
per update so changes to the robot's speed calibration are retained. Reset between runs; close
the controller when its owner is disposed. Invalid negative/nonfinite inputs are rejected before
advancing PID history. Apply the resulting speed toward the active target, then apply motion limits
separately. This extraction preserves the previous response; it does not introduce a braking profile.

A point-to-point command should use a one-destination `PathDistance`, preserving its current
stopping boundary. Only a continuous driving segment should include subsequent destinations,
and its list must end at the next intended stop. Do not include travel after a shooting stop or
blocking action in a command that still ends at an intermediate point. The existing `Auto` API
continues to build separate drive commands with `build(...)`. Continuous execution is opt-in below.

## Stopping and settled arrival

`CompletionCriteria` separates position/heading tolerances from measured translation/angular
speed limits and a settle duration. All use meters, radians and seconds; tolerances and speed
limits must be positive and finite, heading tolerance cannot exceed pi, and settle time may be
zero. There are no robot-specific defaults.

Each stopping command owns a `CompletionChecker`. Reset it on initialization and call
`update(currentPose, goalPose, measuredRobotRelativeSpeeds, requireHeading, timestampSeconds)`
once per control tick. Completion requires position, optional heading, and both measured speed
limits to hold continuously for the settle duration. Angular speed must be low even when heading
is unlocked. Heading error wraps across +/-pi. Invalid feedback, leaving tolerance, or backward
time breaks the window; repeated timestamps cannot advance it. Gate stale feedback with
`HealthChecks.driveHealthy()` before evaluating arrival. Cache the returned result so command
`isFinished()` only reads state, without advancing a timer, controller, or checker.

`DistanceSpeedController.calculateStopping(distance, feedforward, translationTolerance, constraints)`
caps its ordinary PID/feedforward request at `sqrt(2 * maxAcceleration * distanceOutsideTolerance)`
and the maximum translation speed. Inside position tolerance it resets PID history and requests
zero translation. `MotionConstraints.maxAngularSpeedToStop(angleOutsideTolerance)` provides the
equivalent angular ceiling. Request zero omega inside heading tolerance and reset the heading
controller. Pass normal braking requests through `ChassisMotionLimiter`; fault and cancellation
stops bypass it immediately. These request envelopes do not guarantee physical stopping distance.

Check explicit command deadlines during execution and abort the sequence on failure. In particular,
a timed-out final aiming turn must not fall through to shooting. Guard later state-request commands
as well: a sequential group can initialize its next command in the same tick that a failed move ends.
Validate speed thresholds, deceleration and settling on the robot without silently extending deadlines.
More advanced waypoint handoffs remain separate work.

## Continuous path execution

`Auto.buildContinuous(section -> buildDrivePathCommand(section))` groups consecutive drive steps
into one command per section. Both `addDriveToPoint()` and `withPath().toNextPoint()` participate.
Every `addCommand()` separates sections and remains a stop boundary, including instant state
requests. Existing `build(...)` and chooser behavior remain unchanged. Register continuous autos
through the chooser's command-factory overload so each run receives fresh commands.

`Auto.DriveSection` contains an immutable destination list and `firstPointIndex`, the zero-based
drive-step ordinal across the whole routine. Map per-leg settings by that index and list offset,
rather than searching for matching coordinates; repeated points can have different policies.

`PathWaypoint` pairs each pose with its motion constraints, completion criteria, heading-lock
flag and positive timeout. `PathProgress` owns ordered radius-based advancement and uses
`PathDistance` for remaining travel to the section endpoint. Call `reset()` per run and
`advance(position)` per update. Reached intermediate points, including duplicates, advance in
order without waiting for heading or measured-speed settling. The endpoint never advances;
use its `CompletionChecker` to finish. This first version requires entering intermediate position
tolerances; it has no crossing detection, lookahead, corner smoothing or cross-track correction.

Keep one distance controller and chassis limiter alive across the section. Direct translation
toward the active target, but calculate its magnitude from distance remaining to the endpoint.
`PathProgress.maxTranslationSpeed(position)` caps desired speed for the active leg, lower future
speed limits and the final stop. A backwards pass caches exit-speed bounds, subtracting adjoining
position tolerances from available braking distance. Normal updates take constant work except
when advancing across several reached points. The shared limiter uses the section's highest
translation ceiling and most conservative acceleration/angular limits. Speed transitions retain
limiter history; per-leg caps shape desired requests and are not instantaneous measured-speed
guarantees, particularly after pose corrections or target changes.

Check the active waypoint deadline before advancing; reset that timer only on progress. Reset
controllers at section initialization, not waypoint changes. Settle and stop at the endpoint before
the next action. Cancellation or invalid feedback stops immediately and skips later actions.
Validate corners, speed transitions, settling and route deadlines on hardware before competition.

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

`frc.powerlib.health.HealthChecks` shares finite-pose, timestamp freshness, CTRE signal,
mechanism configuration/feedback, and Phoenix drivetrain checks. Callers supply the
maximum signal age. Drivetrain checks support CANcoder modules. Simulation checks retain
configuration and pose validation while bypassing physical CAN connection requirements.
Choose the mechanisms required for a particular action in your robot code; the helper
does not depend on robot states or shooting settings.

## Telemetry Logging

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

## Multiple Limelights

Declare your camera NetworkTables names in `VisionConstants.java`, in priority order:

```java
public static final String[] LIMELIGHT_NAMES = {
    "limelight-b", "limelight-l", "limelight-r"
};
```

The starter `Vision` subsystem handles orientation publishing, MegaTag2 position, independent
MegaTag1 heading correction, disabled-mode throttling, and Swerve pose corrections. An empty array disables camera handling. Configure each
camera's mounting pose, calibration, team number, and AprilTag pipeline in its own Limelight web UI;
names alone cannot describe mounting geometry. All measurements use blue-origin field coordinates.

The reusable `frc.powerlib.vision.LimelightVision` class selects the first acceptable camera,
with position uncertainty `0.07 * distance^2 / tagCount` and
average tag distance below 6.25 meters. It additionally rejects malformed, non-finite, repeated,
future-dated, and stale measurements (over 0.5 seconds old, including latency). Every update consumes
all current camera frames so skipped lower-priority frames are not replayed next loop. MegaTag2
corrects X/Y and ignores its supplied heading. No LimelightHelpers file or extra vendordep is required.

The starter separately reads `botpose_wpiblue` (MegaTag1) to correct slow heading drift in the
pose estimator, without resetting the physical gyro. `VisionConstants.HEADING_CONFIG` uses
conservative defaults for normal enabled correction: at least two distinct tags, positive tag span, ambiguity at most 0.2,
average and individual tag distances at most 4 meters, total age at most 0.2 seconds, and
drivetrain angular speed at most 45 degrees/second. The heading must be within 15 degrees of the
historical drivetrain heading at capture time. Accepted observations use 20 degrees of heading
standard deviation (stored in radians) for gradual correction, while ignoring MegaTag1 X/Y.
Position and heading track their accepted timestamps separately. When heading arrives after a newer
position update, the robot checks its error at capture time and carries that error through intervening
rotation to the newer fusion time, preserving the newer X/Y estimate.
Ordinary heading corrections are suppressed while disabled, during Test mode, or when pose updates are turned off;
camera frames are still consumed. `Vision/Heading/ErrorDegrees` and `Vision/Heading/Accepted` are
logged through CTRE SignalLogger, outside the dashboard data map. Large heading offsets require
an intentional heading/pose reset or the disabled initialization described below;
validate camera mounting and these limits on the robot.

Automatic heading initialization is enabled by default. To disable it, configure
`VisionConstants.java` before startup:

```java
public static final VisionHeadingInitializationConfig HEADING_INITIALIZATION_CONFIG =
    VisionHeadingInitializationConfig.DEFAULT.withEnabled(false);
```

The default policy requires at least five distinct independent heading frames spanning 0.25 seconds,
within a two-degree spread, while disabled with vision updates enabled. Translation speed must be
at most 0.05 m/s and yaw rate at most 5 degrees/s, with drivetrain feedback at most 0.5 seconds old.
While disabled, valid two-or-more-tag heading frames are preferred across cameras, with a single-tag
fallback when none is available. A single-tag frame can have zero tag span; ambiguity, distance,
freshness, and stationary stability checks still apply. Enabled heading corrections continue to
require at least two tags. Camera frames must also meet `HEADING_CONFIG` quality and age limits.
The configuration record allows these thresholds to be adjusted. Initialization sets estimator heading once per disabled period,
preserves X/Y and raw gyro yaw, and logs its status without adding dashboard data fields.

For another drivetrain, call the reader once per robot loop and feed its optional result to your
own pose estimator:

```java
var cameras = new LimelightVision(LIMELIGHT_NAMES);
// In the robot loop, including while pose corrections are disabled:
cameras.update(yawDegrees, pitchDegrees, rollDegrees).ifPresent(measurement -> {
  poseEstimator.addVisionMeasurement(
      measurement.pose(), measurement.timestampSeconds(), measurement.standardDeviations());
});
// Close the reader when shutting down to release NetworkTables handles.
```

`LimelightVisionConfig` exposes the base position uncertainty, maximum tag distance, and maximum
measurement age. `setMeasurementStdDevScale()` accepts robot-specific uncertainty adjustments,
such as trusting vision more during wheel slip; wheel-slip detection is left to the robot.
The three-argument `update()` above remains position-only. For heading candidates, construct with
`new LimelightVision(positionConfig, headingConfig, cameraNames)`, call
`update(yawDegrees, pitchDegrees, rollDegrees, yawRateDegreesPerSecond)`, and then read
`getHeadingMeasurement()`. Call its `correctionPose(historicalPose, maxHeadingErrorDegrees)` with
the estimator pose at the measurement timestamp, then use its heading-only `standardDeviations()`.
The five-argument `update(..., allowSingleTagHeading)` overload enables the single-tag fallback;
the robot template passes `DriverStation.isDisabled()` so enabled corrections retain the two-tag requirement.
`LimelightHeadingConfig` contains the uncertainty, distance, age, angular-rate, heading-error and
ambiguity limits. In CTRE Swerve, `samplePoseAt()` needs `Utils.fpgaToCurrentTime()`; the installed
Swerve wrapper already performs that conversion for `addVisionMeasurement()`.
The starter enables corrections during both autonomous and teleop. Call
`stateMachine.vision.setShouldUpdatePose(false)` to disable corrections, and `true` to restore them.
While disabled, only stationary heading initialization can apply automatically, when configured on.

`stateMachine.vision.seedFromFreshVision()` explicitly resets drivetrain translation from
the last accepted MegaTag2 measurement while disabled. It uses a fresh independent MegaTag1
heading when available (including the disabled single-tag fallback); otherwise it preserves the drivetrain heading. Frames captured before
the reset cannot subsequently undo it. It returns `false` when enabled,
when no accepted frame is cached, or when the frame is stale, future-dated, or invalid.
The freshness limit comes from `Constants.Vision.CONFIG.maxMeasurementAgeSeconds()`.
Vision keeps reading and caching accepted frames while normal pose corrections are disabled.

On existing installations, the installer writes updated robot files beside the originals as
`.template` files. Adopt the updated `Vision`, `VisionConstants`, and `StateMachine` files together;
the Vision constructor now takes the drivetrain.

## Vendor Dependencies

The installer can add these vendordeps:

```text
vendordeps/ChoreoLib2026.json
vendordeps/PathplannerLib-<latest>.json
vendordeps/maple-sim-0.4.0-beta.json
vendordeps/Phoenix6-replay-<latest>.json
vendordeps/Phoenix5-replay-<latest>.json
```

## Power Tool

Define controller button commands directly in `RobotContainer.configureBindings()`.
Power Tool's Update Code action generates subsystem and Swerve code from
`power-tool/generated/powerlib-subsystems.json`.

Velocity and velocity-torque subsystem entries accept an optional `statorCurrentLimitAmps`
number. Update Code generates `STATOR_CURRENT_LIMIT_AMPS` and passes it to
`VelocitySubsystemConfig`; existing entries without the setting retain Phoenix defaults.
The value must be positive and finite. Direct Java configurations can supply an
`Optional<Double>` as the sixth constructor argument; existing constructors remain supported.
This is startup motor configuration and requires rebuilding and deploying after changes.

The Robot tab shows clickable subsystem cards with live data. Clicking a card
opens its complete tunable list. Constants groups without subsystem data appear
at the end of the cards; command tuning groups also have their own cards. The
header tuning switch remains, and live edits require the robot to acknowledge it.
There are no separate Tuning or Constants tabs and no saved variable selection.

Existing constants appear directly in the same card panel as live tunables.
Published constants have one live row; saved-only values show their saved default.
Edit values and use Apply to publish live changes or save file-only changes to
`power-tool/generated/powerlib-constants.json`. The Reset icon beside each field
discards that field's pending edit. Names and types stay intact, and constants cannot be added or deleted.
Update Code applies saved JSON to Java; Apply does not change Java directly.
Existing Java constants are imported when the
configuration is first created. Constants groups are discovered from the robot's
constants directory, including team-specific groups such as Shooting and Auto.
Generated subsystem entries show only custom constants, keyed by subsystem ID so
renames preserve them. Swerve defaults remain in
`power-tool/generated/powerlib-subsystems.json`; its custom constants use
`power-tool/generated/powerlib-constants.json`. GeneratedTunableConstants and
TunerConstants are excluded. Save, run Update Code, rebuild, and deploy to use changes.

Update PowerLib Library Files once to install the numeric tuning support in an existing
robot project. Numeric constants support live tuning; other types are edited as
saved values. Saving makes numeric fields tunable. Update Code
registers them under `/PowerLib/Subsystems/<Name>/Variables/Custom/<ConstantName>`.
Save, regenerate, rebuild, and deploy; the Robot cards then discover these values
under their subsystem. Turning tuning off keeps the last applied values and skips
constant updates, subsystem tuning checks, and NetworkTables variable synchronization.
Variables are published once at startup and when new tunables are registered so they
remain discoverable. The tuning-toggle check and normal telemetry continue running.
This applies to custom constants, motor and position subsystem settings, Swerve,
and drive-to-point settings. Restarting the robot loads the configured defaults;
use Save Tuned Values, Update Code, and rebuild/deploy to retain changes across restarts.
Save Tuned Values writes custom numeric defaults back to `power-tool/generated/powerlib-constants.json`.
Existing Swerve defaults are already tunable.

Tunable fields are mutable rather than Java compile-time constants, so robot code
must read them during execution to use live edits. Values copied only during
initialization, such as a controller port, still require a restart to change the
initialized object. Numeric types include byte, short, int, long, float, double,
and their boxed equivalents; integer edits must fit the type's whole-number range.

The robot templates include `StateMachineConstants` for the default robot state and
`OIConstants` for the driver controller port, accessible through
`Constants.StateMachine` and `Constants.OI`. `RobotContainerConstants` holds custom
constants for robot container setup.

Power Tool is installed into the robot project as source:

```text
power-tool/
power-tool/dashboard/index.tsx
build-dashboard.ps1
power-tool/scripts/power-tool.cmd
power-tool/scripts/power-tool.ps1
power-tool/scripts/update-power-tool.ps1
power-tool/scripts/install.ps1
power-tool/scripts/project-layout.ps1
power-tool/scripts/generate-subsystem.ps1
power-tool/scripts/powerlib-generate-subsystem.cmd
power-tool/scripts/powerlib-update-subsystems.cmd
power-tool/generated/powerlib-subsystems.json
power-tool/generated/powerlib-constants.json
```

Existing JSON files in the robot project root move into `power-tool/generated/`
automatically. If both locations contain a file, the generated copy stays active
and the old root copy is archived under `power-tool/generated/legacy/`.
Power Tool updates preserve generated configuration and refresh the scripts.

The Drive tab renders `power-tool/dashboard/index.tsx`. This project-owned
folder starts with the generic Drive dashboard and is preserved in full during
updates and reinstalls. Put custom dashboard components, CSS, configuration and
assets here; files under `power-tool/src/` are managed by Robot-Library and
replaced on updates. See the installed `power-tool/dashboard/README.md` for the
component contract and build instructions.

Installs and updates also leave `build-dashboard.ps1` in the robot project root.
To rebuild and package the installed source without updating Power Tool, run
`npm run package:app` from `power-tool/`, or run
`powershell -ExecutionPolicy Bypass -File .\build-dashboard.ps1 -SkipInstall`
from the project root. The Windows app is written to
`PowerTool-local/win-unpacked/Power Tool.exe`. Use `-Publish` (or
`npm run package:publish`) to write to `PowerTool/` instead; this only packages
locally and does not upload a release. Omit `-SkipInstall` when dependencies
need to be installed.

Open it on Windows from the robot project root:

```powershell
.\power-tool\scripts\power-tool.cmd
```

Or run the PowerShell launcher directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\power-tool\scripts\power-tool.ps1
```

Power Tool includes NetworkTables tools and generated subsystem editing. Install builds the app once, then the launchers run the built Electron app with `npm start`. Its `node_modules` folder is created during install and should not be committed.

Power Tool opens on a generic **Drive** dashboard with discovered camera streams, a field view, an autonomous dropdown, and optional drivetrain and robot telemetry. Fresh installations collect feedback through `DriveTelemetry` at the normal robot loop rate and publish it every 100 ms. Power Tool requests and batches telemetry at the same 100 ms cadence. See [Drive dashboard setup](powerlib-dashboard/DRIVE-DASHBOARD.md) for existing-project integration, camera discovery, and topic mappings.

Use `Update Power Tool` inside the app to download the latest Power Tool source, refresh the scripts and project-local skills, reinstall npm dependencies, and restart the app.

## PowerLib Skills

The `skills/` directory contains project-local agent skills for Team 9410 robot projects. The installer copies these files into the installed robot project's root-level `skills/` directory so the skills travel with the project.

### Available Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| `powerlib-sim` | "sim setup", "simulation", "maple sim", "SimManager", "set up sim" | Guides you through entering robot physical values and game piece definitions, then generates all MapleSim integration files from scratch |

### What `powerlib-sim` generates

| File | Action |
|------|--------|
| `gradle.properties` | Created — pins Gradle to WPILib JDK 17 |
| `src/.../simulation/MapleSimSwerveDrivetrain.java` | Created — MapleSim physics wrapper |
| `src/.../simulation/SimManager.java` | Created — game piece spawning and pose publishing |
| `src/.../subsystems/Swerve.java` | Modified — sim thread and pose publisher |
| `src/.../Robot.java` | Modified — `simulationPeriodic()`, `resetField()`, `publishPoses()` |
| `sim-config.md` | Created — reference doc with all values used |

The `powerlib-sim` skill is available in any robot project set up with Robot-Library. It walks you through setting up MapleSim simulation from scratch — something that normally requires reading through vendordep APIs, writing physics config boilerplate, and wiring up several files by hand.

The skill collects your robot's physical properties (weight, bumper size, motor types, wheel COF) and your season's game piece definitions (shape, mass, damping, spawn locations), then generates and modifies all the required files so simulation works out of the box with `./gradlew simulateJava`.

To use it, open your coding agent in your robot project and say something like:

```
set up sim for this robot
```

The skill will take it from there.

---

## Internal Docs

Maintainer notes and development workflow details live in [INTERNAL.md](INTERNAL.md).

Library review coverage and local validation commands live in [tests/README.md](tests/README.md).
