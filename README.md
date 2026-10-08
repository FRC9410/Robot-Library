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

## Autonomous Chooser

The starter `RobotContainer` publishes a standard autonomous dropdown at
`/SmartDashboard/Auto Chooser`. SmartDashboard and Elastic can use a String Chooser widget
for that table. The initial default is `None`.
Selection takes effect when `Robot.autonomousInit()` calls `getAutonomousCommand()`.
The library's `NTChooser` publishes options and reads selections directly through NetworkTables.
`AutoBuilder` updates the robot acknowledgement from its subsystem `periodic()` method.

Register routines in `RobotContainer.configureAutos()` before `autoBuilder.publish()`:

```java
autoBuilder.addAuto("My Auto", this::buildMyAuto);
// Optional: register a different default instead of None.
autoBuilder.setDefaultAuto("Default Auto", this::buildDefaultAuto);
autoBuilder.publish();
```

Optionally tag a routine with WPILib's `DriverStation.Alliance`:

```java
autoBuilder.addAuto("Red Auto", DriverStation.Alliance.Red, this::buildRedAuto);
autoBuilder.addAuto("Blue Auto", DriverStation.Alliance.Blue, this::buildBlueAuto);
// Without an alliance argument, a routine is available for either alliance.
autoBuilder.addAuto("Shared Auto", this::buildSharedAuto);
```

Import `edu.wpi.first.wpilibj.DriverStation` for this example. The chooser updates its
options when the reported alliance changes. While the alliance is unknown, only untagged
routines appear. `setDefaultAuto` also accepts an alliance argument; when that default is
unavailable, the chooser falls back to `None`. A selected routine that becomes unavailable
resolves to the available default. These tags filter routines; they do not mirror paths or
coordinates. Existing running commands continue unchanged.

Factories must return fresh commands, including the children of command groups. The reusable
`frc.powerlib.auto.CommandBuilder` can assemble sequences from factories:

```java
private Command buildMyAuto() {
  return new frc.powerlib.auto.CommandBuilder()
      .runOnce(() -> stateMachine.setWantedState(StateMachine.RobotState.IDLE), stateMachine)
      .waitSeconds(0.5)
      .command(() -> new com.pathplanner.lib.commands.PathPlannerAuto("My Path"))
      .build();
}
```

Use your own actions or driving commands in each step. PathPlanner routines require their
matching deployed auto/path files. The chooser handles missing or stale selections by using
the configured default. Dashboard widgets write `selected` and read the robot's `active`
acknowledgement. Changing the selection does not change an already running routine.

Existing installations receive `RobotContainer.java.template`; adopt its `autoBuilder`
field, `configureAutos()` call/method, and `getAutonomousCommand()` implementation in your
robot container. Updating PowerLib alone preserves your existing robot container.

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

The starter `Vision` subsystem handles orientation publishing, MegaTag2 reads, disabled-mode
throttling, and Swerve pose corrections. An empty array disables camera handling. Configure each
camera's mounting pose, calibration, team number, and AprilTag pipeline in its own Limelight web UI;
names alone cannot describe mounting geometry. All measurements use blue-origin field coordinates.

The reusable `frc.powerlib.vision.LimelightVision` class selects the first acceptable camera,
with position uncertainty `0.07 * distance^2 / tagCount` and
average tag distance below 6.25 meters. It additionally rejects malformed, non-finite, repeated,
future-dated, and stale measurements (over 0.5 seconds old, including latency). Every update consumes
all current camera frames so skipped lower-priority frames are not replayed next loop. Vision
corrects X/Y while preserving gyro heading. No LimelightHelpers file or extra vendordep is required.

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
The starter enables corrections during both autonomous and teleop. Call
`stateMachine.vision.setShouldUpdatePose(false)` to disable corrections, and `true` to restore them.
It always suppresses corrections while the robot is disabled.

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

The Constants tab provides a left-hand menu for generated subsystems, Vision,
StateMachine, OI, RobotContainer, and Swerve. Edit constant values or add custom constants
one row at a time. Custom types are string, boolean, int, and double. Boolean values
use a checkbox; numeric values require finite numbers, and int values must be whole
numbers in range. Constant names automatically use uppercase with underscores in
place of spaces. Use the pencil to edit, the green check to save to
`power-tool/generated/powerlib-constants.json`, and the red X to cancel. Reset discards the current
unsaved row edit and restores its last saved values. Editing another row also
cancels the previous unsaved edit. Deleting a custom constant requires confirmation.
Update Code applies the saved JSON to Java; row saves do not change Java directly.
Existing Java constants are imported when the configuration is first created.
Generated subsystem entries show only custom constants, keyed by subsystem ID so
renames preserve them. Swerve defaults remain in `power-tool/generated/powerlib-subsystems.json`, and its
custom constants use `power-tool/generated/powerlib-constants.json`. TunerConstants is excluded.
Save, run Update Code, rebuild, and deploy to use changes.

Update PowerLib Library Files once to install the numeric tuning support in an existing
robot project. The **Tunable** column automatically shows **Yes** for numeric constants
and **No** for other types. Saving makes numeric fields tunable. Update Code
registers them under `/PowerLib/Subsystems/<Name>/Variables/Custom/<ConstantName>`.
Save, regenerate, rebuild, and deploy; the Tuning tab then discovers these values
under their subsystem. Turning tuning off keeps the last applied values and skips
constant updates, subsystem tuning checks, and NetworkTables variable synchronization.
Variables are published once at startup and when new tunables are registered so they
remain discoverable. The tuning-toggle check and normal telemetry continue running.
This applies to custom constants, motor and position subsystem settings, Swerve,
and drive-to-point settings. Restarting the robot loads the configured defaults;
use Save Tuned Values, Update Code, and rebuild/deploy to retain changes across restarts.
Save Tuned Values writes custom numeric defaults back to `power-tool/generated/powerlib-constants.json`.
Existing Swerve defaults are already tunable and show Yes automatically.

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
power-tool/generated/powerlib-tuning-selection.json
```

Existing JSON files in the robot project root move into `power-tool/generated/`
automatically. If both locations contain a file, the generated copy stays active
and the old root copy is archived under `power-tool/generated/legacy/`.
Power Tool updates preserve generated configuration and refresh the scripts.

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
