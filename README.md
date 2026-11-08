# Robot-Library

Team 9410's PowerLib starter files and Power Tool for a new WPILib Java robot project.

The Windows distribution is an extract-ready ZIP with a prebuilt Power Tool. It uses the new robot project's own Gradle wrapper and team settings.

## Download and start a new project

Download the Windows project ZIP attached to a release from [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases). Choose the packaged project asset, rather than GitHub’s automatic source-code archives.

1. Create a clean **WPILib 2026 Java Command Robot** project with your team number.
2. Extract the **contents** of `Robot-Library-2026-Windows-x64.zip` into its root, beside `build.gradle`. Merge folders and replace the stock starter files and `.gitignore` when prompted.
3. Double-click **Power Tool.cmd**. Power Tool is prebuilt and runs without Node or npm.
4. Configure the robot through **File > Settings**, then build, simulate or deploy from File.

The ZIP contains PowerLib Java source, generic robot starter files, pinned vendor dependency JSONs, skills, and the standalone Windows x64 application in `power-tool/app/`. Its `.gitignore` excludes the entire prebuilt application while leaving robot source and auto authoring files available to commit. The project keeps its original Gradle files, WPILib preferences, team number, `Main.java` and `Robot.java`. WPILib is still required; the first robot build may download vendor libraries.

This is a starter overlay for a **clean project**. Extracting it replaces matching starter files directly. For an existing robot, review the release notes and preserve your project changes before applying files.

### Build the distribution (maintainers)

From Robot-Library on Windows with Node/npm available:

```powershell
.\build-project-zip.ps1
# Reuse installed npm dependencies:
.\build-project-zip.ps1 -SkipInstall
```

Output: `build/distributions/Robot-Library-2026-Windows-x64.zip`. Power Tool is rebuilt and packaged before archiving. For an already packaged app, pass `-PowerToolDirectory .\PowerTool-local\win-unpacked`. The archive has no enclosing folder, includes `.gitignore`, and contains generic templates rather than the test robot's configuration. Pinned vendor snapshots live in `templates/vendordeps/`.

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

## Auto editor

The Power Tool **Autos** tab creates routines through Add step → Add point,
Add wait, Execute state, Wait for state, or Add branch. Standalone state steps run in list order
and select their state in the inspector. Add the first point
through Add step, then drag
the green + handle on the selected point to create a new point immediately after it.
Empty field clicks clear the selection. Drag a point's center to move it, or edit its position,
heading, and motion
limits in the step inspector. Name and alliance share a row above the field.
Generated routines are never defaults and always clear their owned request at the end.
Wait-for-state checks the actual robot state; older saved state timeouts are disabled.

The editor autosaves drafts to `power-tool/generated/powerlib-autos.json`. The single
**Save** button at the bottom of Steps flushes the draft, explicitly writes the owned
`GeneratedAutos.java`, and adds its registration to
`RobotAutos.register` when needed, using the shared source transaction system.
Existing handwritten routines are preserved. **Build Robot** compiles existing Java;
editing or building alone does not regenerate autos. Rebuild and restart desktop
simulation, or deploy to the robot, after saving. The Autos header/toolbar is removed;
outer margins and card gaps are all 12 px. Power Tool opens at 1920 × 1200.

**File > Settings > Auto** sets the autonomous duration used by remaining-time branches in
all routines (20 seconds by default). It shares the Autos editor's draft. **Save auto
settings** saves that draft and updates generated Java; rebuild and restart simulation
or deploy before testing the new duration on the robot.

The first drive point seeds the starting pose in simulation only; a real robot
keeps its measured pose. Generated commands are fresh on each run and release their
state owner on normal completion and cancellation, leaving other owners intact.

Validation blocks generation for duplicate/reserved names, missing robot states,
invalid waits/limits, and missing drive helpers. Names found in handwritten robot
registration code are protected too. Reload discovers Java/source changes. Stale
saves keep the current draft, and newer, malformed, or unsupported auto documents
cannot be overwritten by this editor. Replay and analysis remain in later phases.

Robot check branches scan `src/main/java/frc/robot/helpers/RobotChecks.java`,
which StateMachine exposes as `public final RobotChecks checks = new RobotChecks(this);`.
Add public instance methods that return `boolean` and take no arguments to this file.
Use its `robot` field to access the current StateMachine and its subsystems. For example:

```java
public boolean isPastFourMeters() {
  return robot.drivetrain.getState().Pose.getX() >= 4.0;
}
```

A generated branch calls `robot.checks.isPastFourMeters()`. Then runs when the check
is true; Otherwise runs when it is false after any configured condition wait.
Reload Power Tool after editing Java so the dropdown and source revision refresh.
The ZIP includes an empty `RobotChecks.java` bucket. Add team-specific checks here
and preserve those edits when reviewing a later release.

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

The reusable `frc.powerlib.vision.LimelightVision` class exposes fresh position candidates ordered by
their calculated position uncertainty, then capture freshness; configured camera order breaks ties.
The starter tries each candidate until its complete position filter accepts one,
with position uncertainty `0.07 * distance^2 / tagCount` and
average tag distance below 6.25 meters. It additionally rejects malformed, non-finite, repeated,
future-dated, and stale measurements (over 0.5 seconds old, including latency). Every update consumes
all current camera frames so skipped lower-priority frames are not replayed next loop. MegaTag2
corrects X/Y and ignores its supplied heading. No LimelightHelpers file or extra vendordep is required.

The starter separately reads `botpose_wpiblue` (MegaTag1) to correct slow heading drift in the
pose estimator, without resetting the physical gyro. `VisionConstants.HEADING_CONFIG` uses
conservative defaults for normal enabled correction: at least two distinct tags, positive tag span, ambiguity at most 0.2,
average and individual tag distances at most 4 meters, total age at most 0.2 seconds, and
drivetrain angular speed at most 45 degrees/second. The default heading-error limits are 180 degrees
while stationary and 45 degrees while moving. Stationary means measured translation speed at most
0.05 m/s and yaw rate at most 5 degrees/s. `maxHeadingErrorDegrees` sets the stationary limit and
`maxMovingHeadingErrorDegrees` sets the moving limit; the six-argument constructor retains its
single limit for both conditions. Accepted observations use 20 degrees of heading
standard deviation (stored in radians) for gradual correction, while ignoring MegaTag1 X/Y.
Moving heading correction uses this normal fusion path; stationary hard recovery is described below.
Heading candidates prefer multi-tag over single-tag, then rank lower distance squared per tag,
lower maximum tag ambiguity, greater tag span, and capture freshness. Configured camera order breaks
remaining ties. This is a quality ranking, not agreement voting between cameras. If a candidate fails the
capture-time gate, estimator-history lookup, or heading-error check, the starter tries the next camera
and stops after one accepted correction. `getHeadingMeasurement()` remains a compatibility accessor
for the first candidate before those downstream checks.
After confirmation (or the first accepted moving correction), `VisionHeadingSelector` retains the selected heading camera through ordinary
frame gaps. An equally ranked or poorer camera cannot replace it simply by publishing more often.
A challenger must retain better tag geometry/quality for at least the initialization frame count
and duration (five frames over 0.25 seconds by default). Stationary handoffs also require the
camera's independent stable-heading window; single-tag recovery keeps its stricter policy.
A stale selected camera releases selection after the existing heading freshness limit; downstream
rejection or inconsistent stationary readings also release it. This preference survives automatic
heading resets and mode changes, but explicit seeds and toggling corrections clear it.
Aligned stable candidates can confirm selection without resetting heading or position history.
While stationary, a camera flagged inconsistent must rebuild its stable window before heading
corrections resume. Other eligible cameras and position updates continue during that collection.
Moving heading confirmation tracks each camera separately, so disagreement from one camera cannot
erase another camera's confirmation evidence. Stability windows restart after completion to bound
ongoing work and avoid comparing slow real yaw against an anchor retained since startup.
Heading freshness, capture-time error checks and error diagnostics are owned by `VisionMeasurementFusion`.
Position cache selection and fusion selection share one pass through the camera candidates. Accepted
positions reuse the capture-time pose sampled for filtering, and heading validation calculates the
angular error without constructing a corrected pose. Cached frames are checked again when used for a manual seed.
`VisionMeasurementFusion` tracks accepted position and heading timestamps separately for each camera,
so a faster pipeline cannot starve a qualified slower camera during a handoff. Each observation
keeps its capture timestamp and original uncertainty. When a delayed observation arrives, the helper
reapplies only the newer accepted observations within the measurement-age window, so neither pipeline
discards the other's corrections. Position observations preserve historical heading; heading observations
preserve historical X/Y. Camera rejection and large-correction evidence are tracked per camera, so a
rejected camera cannot consume another camera's frame or erase its recovery evidence.
Once heading is established, ordinary corrections continue while disabled. Test mode suppresses
automatic heading initialization, stationary heading recovery and weighted heading correction;
valid position corrections continue using the established heading. Turning pose updates off
suppresses both position and heading corrections. Camera frames are still consumed in either case.
`Vision/Heading/ErrorDegrees` and `Vision/Heading/Accepted` are
logged through CTRE SignalLogger, outside the dashboard data map. Disabled initialization below
can establish heading directly rather than waiting for gradual fusion;
validate camera mounting and these limits on the robot.

Automatic heading initialization is enabled by default. To disable it, configure
`VisionConstants.java` before startup:

```java
public static final VisionHeadingInitializationConfig HEADING_INITIALIZATION_CONFIG =
    VisionHeadingInitializationConfig.DEFAULT.withEnabled(false);
```

The default multi-tag policy requires at least five distinct independent heading frames spanning 0.25 seconds,
within a two-degree spread, with vision updates enabled. Translation speed must be
at most 0.05 m/s and yaw rate at most 5 degrees/s, with drivetrain feedback at most 0.5 seconds old.
Two-or-more-tag heading frames are preferred across cameras. A stationary single-tag fallback requires
distance at most 2 m, ambiguity at most 0.05, frame age at most 100 ms, and at least ten distinct frames
spanning 0.5 seconds within a one-degree spread. Unknown single-tag quality is rejected. A single tag
can have zero tag span. Existing `HEADING_CONFIG` limits still apply if stricter. Moving heading fusion
requires at least two tags. Stationary recovery works while disabled or enabled and preserves X/Y and
raw gyro yaw. Once heading is established, hard recovery only starts for errors over 5 degrees, avoiding
repeated resets of an already-correct estimate. Each eligible camera contributes its own evidence;
the highest-ranked camera with sufficient stable evidence is selected without cross-camera averaging.
Qualified stationary single-tag observations also correct errors within the five-degree agreement
tolerance through normal weighted fusion, without resetting heading or interrupting position updates.
Qualification requires the same strict single-tag window and is cleared by motion, stale/invalid
evidence, or inconsistent observations. Multi-tag evidence alone cannot qualify a single-tag solve.

`HEADING_INITIALIZATION_CONFIG` owns the stationary speed/yaw limits and drivetrain-feedback age
for recovery and camera arbitration. The same speed/yaw policy selects the configured stationary
or moving correction limit. Setting `enabled` to false disables automatic startup initialization
and hard resets; passive stability collection and qualified camera handoffs continue, as does
normal weighted heading fusion. The robot uses the shared collector directly, without a separate
robot-side forwarding helper.

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

The `Vision` template also applies `VisionPoseFilter`, configured through
`VisionConstants.POSE_FILTER_CONFIG`. Its field bounds come from `LocationConstants`; set those
to your season's blue-origin field dimensions. The robot-specific integration uses its own field bounds.
Starting thresholds reject pitch/roll beyond 8 degrees, require 0.15 s of continuously observed
level feedback, and restart that interval if gyro data becomes invalid/stale or loop observations
are separated by more than 0.1 s. Only images captured after the complete level interval are
eligible; delayed bump images remain rejected after landing. Heading candidates and disabled
manual pose seeds use the same capture-time gate. Reading/consuming camera frames continues
while corrections are blocked, preventing rejected frames from being replayed later.

Position candidates must be within the configured field bounds plus a 0.25 m margin, with
absolute robot-origin height no more than 0.5 m. `Measurement.heightMeters()` preserves the
camera's Z coordinate; the existing six-argument planar constructor remains supported.
For enabled fusion, the filter compares camera position with estimator history at image capture
time. Missing history rejects the frame. Corrections exceeding 1 m require at least three distinct
capture times spanning 0.1 s, with correction vectors agreeing within 0.25 m of their anchor.
Comparing vectors rather than absolute positions allows recovery while the robot moves.
Inconsistent/invalid samples, tilt, missing gyro observations and long camera gaps clear recovery
evidence. A normal correction clears it too. Repeated observations can therefore recover genuine
wheel-slip error without accepting a single large outlier or permanently rejecting large offsets.

Fusion uses `measurement.standardDeviations()` so distance, tag count and uncertainty scaling
reach the estimator; the MT2 heading remains ignored. `Vision/Position/Status` logs the gate/recovery
state without adding dashboard fields. These settings are starting values to test on hardware.
Agreement does not prove a camera's calibration or tag map is correct; check mounting pose, field
map and gyro signs. Low-level `LimelightVision` readers expose measurements but do not apply
robot-specific filtering automatically: call `observe()` every loop, `plausible()` for cached/manual
seeds and `acceptPosition()` with capture-time estimator history before fusion. Adopt updated
`Vision`, `Swerve`, and `VisionConstants` templates together in an existing robot project.

`LimelightVisionConfig` exposes the base position uncertainty, maximum tag distance, and maximum
measurement age. `setMeasurementStdDevScale()` accepts robot-specific uncertainty adjustments,
such as trusting vision more during wheel slip; wheel-slip detection is left to the robot.
The three-argument `update()` above remains position-only. For heading candidates, construct with
`new LimelightVision(positionConfig, headingConfig, cameraNames)`, call
`update(yawDegrees, pitchDegrees, rollDegrees, yawRateDegreesPerSecond)`, and then read
`getHeadingMeasurements()`. Use `getPositionMeasurements()` for downstream position fallback; both read-only
views are valid until the next update. The starter supplies accepted observations to
`VisionMeasurementFusion`, using FPGA seconds for its history and estimator callbacks.
The five-argument `update(..., allowSingleTagHeading)` overload enables the single-tag fallback;
the robot template permits this while disabled or stationary, with the stricter quality and stability policy above.
`LimelightHeadingConfig` contains the uncertainty, distance, age, angular-rate, heading-error and
ambiguity limits. In CTRE Swerve, `samplePoseAt()` needs `Utils.fpgaToCurrentTime()`; the
Swerve wrapper already performs that conversion for `addVisionMeasurement()`.
The starter enables corrections while disabled, during autonomous and during teleop. Call
`stateMachine.vision.setShouldUpdatePose(false)` to disable corrections, and `true` to restore them.
With heading initialization enabled, automatic position fusion initially waits for a trustworthy heading.
Disabled MT1 initialization or an explicit pose/heading reset establishes it immediately. While enabled,
normal multi-tag heading fusion can also release the guard after capture-time heading error stays within
5 degrees for at least the configured frame count and
duration (five distinct accepted frames spanning 0.25 seconds). The robot may move during this agreement
check; moving heading correction remains gradual. Stationary recovery can reset heading directly after
the stable evidence window completes. Rejected candidate batches, excessive error, stale
frames and long gaps restart the agreement window. No timeout blindly trusts the current heading.
`Swerve` tracks explicit `resetPose()` and `resetRotation()` calls, including autonomous pose seeds;
`Vision` notices resets made during its lifetime on the next loop. Normal estimator corrections do not
count as resets. `isHeadingEstablished()` exposes the processed readiness state. After heading becomes
trusted, the starter discards MT2 frames captured before publishing the corrected orientation, including
delayed frames received later. The corrections-off switch still blocks fusion. Turning heading
initialization off explicitly trusts the configured drivetrain heading and skips this startup guard.
The enabled-recovery agreement tolerance is independent of disabled initialization's 2-degree
heading-spread limit; changing one does not change the other.
Stationary initialization keeps separate sample windows for each camera. Selecting another camera
does not erase evidence from a still-fresh camera or combine their headings into one average.
Motion clears all windows; stale or inconsistent observations discard the affected camera's evidence.
Normal position acceptance clears only that camera's large-correction window; fallback acceptance cannot
erase another camera's consistent recovery evidence. Motion/tilt safety events and explicit resets still
clear all relevant recovery windows.

`stateMachine.vision.seedFromFreshVision()` explicitly resets drivetrain translation from
the last plausible MegaTag2 measurement while disabled, even if automatic fusion rejected its correction
size or lacked estimator history. It uses a fresh independent MegaTag1
heading when available (including the disabled single-tag fallback); otherwise it preserves the drivetrain heading. Frames captured before
the reset cannot subsequently undo it. It returns `false` when enabled,
when no plausible frame is cached, or when the frame is stale, future-dated, or invalid.
The freshness limit comes from `Constants.Vision.CONFIG.maxMeasurementAgeSeconds()`.
Vision keeps reading and caching plausible frames while normal pose corrections are disabled.
`hasFreshMeasurement()` reports this manual-seed freshness for compatibility. Use
`hasFreshAcceptedMeasurement()` for dashboard accepted-vision status or shooting confidence: it checks
the most recent position frame actually fused or explicitly seeded, and rejected frames cannot refresh it.

When integrating a release into an existing robot, review `Vision`, `VisionConstants`,
and `StateMachine` together; the Vision constructor takes the drivetrain.

## Vendor Dependencies

The release ZIP includes these pinned vendor dependency files:

```text
vendordeps/ChoreoLib2026.json
vendordeps/PathplannerLib-2026.1.2.json
vendordeps/maple-sim-0.4.0-beta.json
vendordeps/Phoenix6-replay-26.3.0.json
vendordeps/Phoenix5-replay-5.36.0.json
```

## Power Tool

Define controller button commands directly in `RobotContainer.configureBindings()`.
Power Tool saves configuration directly into robot Java source. File > Settings saves patch the affected declarations and registrations immediately; File > Build Robot compiles the current source. There is no JSON-to-code generation step.

File > Build and Deploy builds first, then deploys using the robot project’s Gradle configuration. Sim with DS and Sim without DS both rebuild before launching the simulation GUI. Sim with DS connects to an already-running FRC Driver Station; Sim without DS uses the simulation GUI’s Driver Station controls. Close the running simulation before launching another. Simulation output is written to `build/power-tool/simulation.log`.

Dashboard mechanism cards open their tunables when Tuning is enabled and acknowledged. Apply changes the running robot through NetworkTables. Save Tuned Values reviews live differences and writes selected mechanism, sensor, drivetrain, localization and custom defaults together in one Java transaction. Rebuild and deploy to use saved defaults at startup.

Velocity and velocity-torque mechanisms support an optional positive, finite stator current limit. A blank value preserves Phoenix defaults. Signed feedback ratios and optional feedforward/default-position values remain supported. Source edits preserve existing annotations, modifiers, comments, custom methods and handler bodies. Unsupported expressions are read-only and require editing in Java. If source changes while a form is open, refresh before saving; the draft is retained.

File > Settings manages subsystem structure, state names and camera configuration. Stable subsystem IDs live in Java comments; changing the display name preserves the source class. Idle is implicit, hidden from the state list and always last in the enum and handler registry. Existing state bodies and handler priority are preserved. Confirmed deletion removes the state immediately, including edited Java, unless other source still references it. Manual Java additions appear when configuration refreshes.

Constants groups are discovered from the robot constants directory, including team-specific classes. Custom numeric constants are registered under `/PowerLib/Subsystems/<Name>/Variables/Custom/<ConstantName>`. Existing fields retain their tuning annotations; newly added numeric custom constants become tunable. GeneratedTunableConstants and TunerConstants are excluded from the constants editor.

Temporary live tuning recovery is separate from code defaults. Successfully applied tunables are cached as JSON under Power Tool's app-local user-data directory, isolated by project, connection profile, host and port. After restarting the app, Restore edits places matching values into pending drafts. It never publishes automatically; review and Apply to send them. Restarting the robot loads the saved Java defaults. Turning tuning off keeps the last live values but stops further tuning synchronization.

Old `powerlib-subsystems.json` and `powerlib-constants.json` files are read only by migration review. Choose saved differences to import, or keep Java values. Migration backs up source and legacy files under `build/power-tool-migration/` before archiving the old active files. Malformed JSON or a stale review is rejected. Old JSON generation commands refuse to run, so stale saved data cannot overwrite Java.

Tunable fields are mutable rather than Java compile-time constants, so robot code
must read them during execution to use live edits. Values copied only during
initialization, such as a controller port, still require a restart to change the
initialized object. Numeric types include byte, short, int, long, float, double,
and their boxed equivalents; integer edits must fit the type's whole-number range.

The robot templates include `StateMachineConstants` for the default robot state and
`OIConstants` for the driver controller port, accessible through
`Constants.StateMachine` and `Constants.OI`. `RobotContainerConstants` holds custom
constants for robot container setup.

The release ZIP includes the prebuilt application and its launcher:

```text
Power Tool.cmd
power-tool/app/Power Tool.exe
power-tool/app/resources/
power-tool/release.txt
```

Double-click **Power Tool.cmd** in the robot project root. The application includes
its Electron runtime and provides NetworkTables tools, robot settings, autonomous
editing, and log viewing. Its bundled application files are excluded from Git by
`/power-tool/app/`; robot source and auto definitions remain available to commit.

Power Tool opens on a generic **Dashboard** view with discovered camera streams, a field view, an autonomous dropdown, and optional drivetrain and robot telemetry. The starter robot collects feedback through `DriveTelemetry` at the normal robot loop rate and publishes it every 100 ms. Power Tool requests and batches telemetry at the same 100 ms cadence. See [Dashboard setup](powerlib-dashboard/DASHBOARD.md) for existing-project integration, camera discovery, and topic mappings.

Get new versions from [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases). Review the release notes before updating an existing robot project.

## PowerLib Skills

The release ZIP includes project-local agent skills in the root-level `skills/` directory so they travel with the robot project.

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
