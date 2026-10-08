# Generic Drive dashboard

Power Tool opens on the **Drive** tab. It is a season-independent competition view: match time, battery voltage, robot state, and Crew tools use the game prototype's header cards. Camera thumbnails sit on the left, a field or selected camera in the center, autonomous selection on the right, and drivetrain feedback at the bottom above the connection status bar. The drivetrain card shows X, Y, signed heading and an active heading target. Requested and actual robot states appear separately beside battery voltage. Invalid pose produces a fault indication; valid pose does not establish hardware health. The layout measures the Power Tool header and uses the remaining window height without page scrolling. The camera list scrolls independently; field and camera images preserve their actual aspect ratios.

No shooter, intake, hub, passing, or other game-specific telemetry is assumed. Optional information appears only when its topics exist. The bottom row discovers subsystem `Velocity` or `Position` readings in the shared data map. Each mechanism card shows its actual value and, when published, a smaller yellow setpoint directly beneath it. Velocity uses `VelocitySetpoint`; position uses `SetpointRotations` or `Setpoint`. Zero is a valid setpoint; missing, invalid, disconnected, or stale targets stay hidden. Position units come from the subsystem configuration when available. The drivetrain heading target also appears below the measured heading. A grid provides the generic field view; configure field dimensions and orientation in **Crew tools**. The initial dimensions are 16.54 × 8.07 m and must be adjusted for the field being used. Coordinates use the blue origin; flipping rotates the display without changing coordinates.

## Robot integration

Fresh PowerLib installations wire `DriveTelemetry` into `PowerDashboard`. It collects drive data into the subsystem data map, then `SubsystemTelemetry` publishes one complete JSON map at `/PowerLib/Data` every 100 ms (10 Hz), while logging the latest values every 20 ms (50 Hz). Power Tool requests the latest NT4 feedback every 100 ms and batches screen updates at that cadence. Robot control and input collection continue at the normal scheduler rate.

For an existing project, update PowerLib and run Update Code to migrate `PowerDashboard` to this shared flow. For a custom integration, collect drive data before the shared publisher runs:

```java
private final DriveTelemetry driveTelemetry = new DriveTelemetry()
    .withPose(() -> drivetrain.getState().Pose)
    .withHeadingSetpoint(() -> drivetrain.getHeadingSetpointDegrees())
    .withRequestedState(() -> stateMachine.getWantedState().name())
    .withActualState(() -> stateMachine.getActualState().name());

private final RobotLogTelemetry robotLogTelemetry = new RobotLogTelemetry()
    .withDriverControllerPort(Constants.OI.DRIVER_CONTROLLER_PORT);
// Optionally add .withAutonomousStatus(stateMachine::getAutoStatus, stateMachine::getAutoReason).

// Inside the existing periodic method, called every 20 ms:
driveTelemetry.publish();
SubsystemTelemetry.publish(); // Once per loop in PowerDashboard, after collecting telemetry.
robotLogTelemetry.log(); // Separate log-only status, sampled every 20 ms (50 Hz).
```

Import `frc.powerlib.dashboard.DriveTelemetry`, `frc.powerlib.dashboard.SubsystemTelemetry`, and `frc.powerlib.dashboard.RobotLogTelemetry`. Keep only one shared publisher call per loop. Pose, heading-setpoint, and state suppliers are optional. Differential and other drivetrains can supply their own `Pose2d` and an optional heading target; the collector has no Phoenix dependency, while the shared writer logs through CTRE SignalLogger. Robot mode, battery, alliance, match time, CAN utilization, and an advancing heartbeat are supplied by WPILib. DS/FMS/controller connection, brownout, and optional autonomous status/reason are log-only under `PowerLib/RobotStatus/<key>`, bypassing the shared data map and NetworkTables. Invalid or missing pose samples publish a validity flag and are withheld from the display. Chassis speed and gyro/module health telemetry are omitted. Robot-side control feedback checks still operate.

The live dashboard transport is one JSON topic, `/PowerLib/Data`, containing `schemaVersion: 1`, `sequence`, `timestampSeconds` and the complete `subsystems` map. Power Tool replaces all decoded data fields on each valid frame and removes absent fields; malformed frames do not refresh freshness. It preserves unrelated tuning and chooser topics. The names below describe locally decoded Drive metrics, represented in the UI under `/PowerLib/Subsystems/Drive/Data`; individual scalar topics are no longer transmitted. The typed Pose topic is retained for AdvantageScope. Each value is still written to SignalLogger with the name `PowerLib/Subsystems/Drive/Data/<key>`:

| Topics | Type / units |
| --- | --- |
| `Heartbeat` | changing double, once per loop |
| `Enabled` | boolean |
| `RioCanUtilization` | double, utilization fraction (0–1) |
| `Mode`, `Alliance`, optional `RequestedState`, `ActualState` | string |
| `BatteryVolts`, `MatchTimeSeconds` | double; negative match time means unavailable |
| optional `Pose` | `struct:Pose2d`; typed pose for AdvantageScope field and heatmap views |
| optional `PoseValid` | boolean; prevents invalid cached poses from appearing current |
| optional `Pose/XMeters`, `Pose/YMeters`, `Pose/HeadingDegrees` | double, m / degrees |
| optional `HeadingSetpointDegrees` | degrees; JSON null clears an inactive target (NaN internally) |

Requested and actual states appear separately beside battery voltage. Supply an actual-state
function backed by the robot controller; omit it if the robot does not track effective state.
Missing or stale status displays UNKNOWN. The legacy `withState` collector remains supported
for custom consumers, but its value is not assumed to be an actual state.

Topic aliases and initial field dimensions are in [`src/features/drive/drive-template.json`](src/features/drive/drive-template.json). The template reads the current `/PowerLib/Subsystems/Drive/Data/Pose` struct, older `/PowerLib/Drive` topics and existing PowerLib Swerve pose scalars, `/Robot/Pose` (`struct:Pose2d`), and `/SmartDashboard/Field/Robot` (`double[]` containing x, y, heading degrees). Legacy pose-only publishers cannot establish robot mode or reliably prove a stationary robot loop is alive; add the generic telemetry publisher to unlock auto selection and provide status. Feedback becomes stale after 1.2 s without a heartbeat; live values clear and auto selection locks.

## Cameras

Publish HTTP MJPEG addresses in `/CameraPublisher/<name>/streams` as a string array. Power Tool accepts plain HTTP/HTTPS URLs and `mjpg:` / `mjpeg:` prefixes. WPILib CameraServer publishes this metadata automatically. URLs with embedded credentials and other protocols are excluded.

Named `limelight` / `limelight-...` tables publishing `hb` or `heartbeat` are also discovered, using `http://<name>.local:5800/`. Crew tools can override a discovered camera's URL, including replacing mDNS with its configured static IP. Overrides stay on this laptop. These conventions are documented in [WPILib camera discovery](https://docs.wpilib.org/en/stable/docs/software/dashboards/shuffleboard/custom-widgets/builtin-plugins.html#stream-discovery) and the [Limelight network setup](https://docs.limelightvision.io/docs/docs-limelight/getting-started/limelight-3#5-network-configuration).

The camera list scrolls vertically beneath the fixed field thumbnail, using the mouse wheel, scrollbar, or keyboard. Each visible camera, plus a selected camera outside the visible list, has one stream connection shared by its thumbnail and main view. Hidden, unselected cameras do not keep streams running. Streams retain their source ratio inside square camera viewports. Failed streams retry every four seconds; published `connected=false` is displayed as unavailable. The camera feeds travel over HTTP; NetworkTables supplies their discovery metadata.

The bottom status bar shows alliance and RIO CAN utilization. Match time remains in the header. DS/FMS/controller connection, brownout, and autonomous status/reason are log-only and have no live dashboard indicators. `RobotLogTelemetry.withDriverControllerPort(port)` configures the logged controller status; generated dashboards use `Constants.OI.DRIVER_CONTROLLER_PORT` and the logger defaults to port 0.

## Autonomous

The tab uses PowerLib AutoBuilder's `/SmartDashboard/Auto Chooser` exclusively. Register routines through `frc.powerlib.auto.AutoBuilder` and call `publish()` after registration. The selector disappears if AutoBuilder has not published a valid chooser.

AutoBuilder filters options using the Driver Station alliance: red shows red-specific and unrestricted routines; blue shows blue-specific and unrestricted routines. When alliance is unknown, only unrestricted routines are shown. The built-in `None` remains available. Register unrestricted routines with `addAuto(name, factory)` and alliance-specific routines with `addAuto(name, Alliance.Red, factory)` or `Alliance.Blue`. The dashboard displays the robot's published options directly. AutoBuilder refreshes them when alliance changes and resolves an unavailable selection to the available default, or `None` when the configured default is unavailable.

Selection writes `<chooser>/selected`. The display follows the robot's `<chooser>/active` acknowledgement and reports a missing acknowledgement after three seconds. Changes are locked while enabled, disconnected, stale, or when the chooser explicitly publishes `.controllable=false`. A live `Enabled=false` and Drive heartbeat are required; a missing enabled state does not count as disabled. The team's robot remains responsible for deciding which autonomous command runs.

Crew tools also exports a local JSON telemetry snapshot, including binary topic bytes. Robot-specific driver bindings are deliberately left for each team to define.

## Validation

Run `npm run check:drive` for discovery, URL, chooser, freshness, validity, struct-pose, and clock checks. Run `npm run build` for renderer and Electron compilation. Live verification uses an isolated NT4 server and MJPEG fixtures; actual robot cameras should also be checked on the team's network before competition.

Drivetrain displays X, Y, heading, and a heading target only while heading control is active.
Manual rotation, command completion, cancellation, disabled mode, and Test mode clear the
target. Current Swerve templates collect pose scalars and a typed Pose2d in the shared map.
The shared 100 ms writer sends the scalars within the complete JSON frame and derives the
AdvantageScope struct topic from that same captured map. The struct stays on NetworkTables in both simulation and real operation
and is also recorded in the CTRE log with its schema. No separate fast pose/module-state
publisher is restored. Legacy pose aliases remain readable.

Run `npm run check:telemetry` to verify complete-object replacement, removed fields, burst
handling, malformed-frame rejection, pose decoding and reset to a legacy robot.
