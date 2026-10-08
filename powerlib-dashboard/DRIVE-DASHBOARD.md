# Generic Drive dashboard

Power Tool opens on the **Drive** tab. It is a season-independent competition view: match time, battery voltage, robot state, and Crew tools use the game prototype's header cards. Camera thumbnails sit on the left, a field or selected camera in the center, autonomous selection on the right, and drivetrain feedback at the bottom above the connection status bar. The drivetrain card is 300 px wide, capped by the available width, with X, Y, and signed heading on one row and compact GYRO/module health labels underneath. Robot state displays the published state alone. The drivetrain tint is green when all published health signals are connected, red for a failed signal or invalid feedback, and gray for unknown or stale health. Pose alone cannot establish hardware health. The layout measures the Power Tool header and uses the remaining window height without page scrolling. The camera list scrolls independently; field and camera images preserve their actual aspect ratios.

No shooter, intake, hub, passing, or other game-specific telemetry is assumed. Optional information appears only when its topics exist. A grid provides the generic field view; configure field dimensions and orientation in **Crew tools**. The initial dimensions are 16.54 × 8.07 m and must be adjusted for the field being used. Coordinates use the blue origin; flipping rotates the display without changing coordinates.

## Robot integration

Fresh PowerLib installations wire `DriveTelemetry` into `PowerDashboard`. It collects drive data into the subsystem data map, then `SubsystemTelemetry` publishes and logs the latest map every 100 ms (10 Hz). Power Tool requests the latest NT4 feedback every 100 ms and batches screen updates at that cadence. Robot control and input collection continue at the normal scheduler rate.

For an existing project, update PowerLib and run Update Code to migrate `PowerDashboard` to this shared flow. For a custom integration, collect drive data before the shared publisher runs:

```java
private final DriveTelemetry driveTelemetry = new DriveTelemetry()
    .withPose(() -> drivetrain.getState().Pose)
    .withSpeeds(() -> drivetrain.getState().Speeds)
    .withState(() -> stateMachine.getWantedState().name());

// Inside the existing periodic method, called every 20 ms:
driveTelemetry.publish();
SubsystemTelemetry.publish(); // Once per loop in PowerDashboard, after collecting telemetry.
```

Import `frc.powerlib.dashboard.DriveTelemetry` and `frc.powerlib.dashboard.SubsystemTelemetry`. Keep only one shared publisher call per loop. Pose, speed, and state suppliers are optional. Differential and other drivetrains can supply their own `Pose2d` and `ChassisSpeeds`; the collector has no Phoenix dependency, while the shared writer logs through CTRE SignalLogger. Robot mode, battery, brownout, alliance, DS/FMS attachment, match time, and an advancing heartbeat are supplied by WPILib. Invalid or missing pose/speed samples publish a validity flag and are withheld from the display. No current, module health, or gyro health is inferred. Optional `withGyroConnected(BooleanSupplier)` and `withModuleConnected(name, BooleanSupplier)` suppliers provide actual communication health. Fresh CTRE swerve templates wire the Pigeon and FL/FR/BL/BR modules; each module requires its drive motor, steer motor, and encoder to be connected. Custom drivetrains can omit these suppliers or publish their own module names.

The contract lives under `/PowerLib/Subsystems/Drive/Data`. Each value is also written to SignalLogger with the name `PowerLib/Subsystems/Drive/Data/<key>`:

| Topics | Type / units |
| --- | --- |
| `Heartbeat` | changing double, once per loop |
| `Enabled`, `DsAttached`, `FmsAttached`, `BrownedOut`, `DriverControllerConnected` | boolean |
| `RioCanUtilization` | double, utilization fraction (0–1) |
| `Mode`, `Alliance`, optional `State` | string |
| `BatteryVolts`, `MatchTimeSeconds` | double; negative match time means unavailable |
| optional `PoseValid`, `SpeedsValid` | boolean |
| optional `Pose/XMeters`, `Pose/YMeters`, `Pose/HeadingDegrees` | double, m / degrees |
| optional `Speeds/VXMetersPerSecond`, `Speeds/VYMetersPerSecond`, `Speeds/OmegaRadiansPerSecond` | double, m/s / rad/s |
| optional `GyroConnected` | boolean; publish only if backed by an actual gyro connection signal |
| optional `Modules/<name>/Connected` | boolean; actual module communication health |

Topic aliases and initial field dimensions are in [`src/features/drive/drive-template.json`](src/features/drive/drive-template.json). The template also reads older `/PowerLib/Drive` topics and existing PowerLib Swerve pose/speed scalars, `/Robot/Pose` (`struct:Pose2d`), and `/SmartDashboard/Field/Robot` (`double[]` containing x, y, heading degrees). Legacy pose-only publishers cannot establish robot mode or reliably prove a stationary robot loop is alive; add the generic telemetry publisher to unlock auto selection and provide status. Feedback becomes stale after 1.2 s without a heartbeat; live values clear and auto selection locks.

## Cameras

Publish HTTP MJPEG addresses in `/CameraPublisher/<name>/streams` as a string array. Power Tool accepts plain HTTP/HTTPS URLs and `mjpg:` / `mjpeg:` prefixes. WPILib CameraServer publishes this metadata automatically. URLs with embedded credentials and other protocols are excluded.

Named `limelight` / `limelight-...` tables publishing `hb` or `heartbeat` are also discovered, using `http://<name>.local:5800/`. Crew tools can override a discovered camera's URL, including replacing mDNS with its configured static IP. Overrides stay on this laptop. These conventions are documented in [WPILib camera discovery](https://docs.wpilib.org/en/stable/docs/software/dashboards/shuffleboard/custom-widgets/builtin-plugins.html#stream-discovery) and the [Limelight network setup](https://docs.limelightvision.io/docs/docs-limelight/getting-started/limelight-3#5-network-configuration).

The camera list scrolls vertically beneath the fixed field thumbnail, using the mouse wheel, scrollbar, or keyboard. Each visible camera, plus a selected camera outside the visible list, has one stream connection shared by its thumbnail and main view. Hidden, unselected cameras do not keep streams running. Streams retain their source ratio inside square camera viewports. Failed streams retry every four seconds; published `connected=false` is displayed as unavailable. The camera feeds travel over HTTP; NetworkTables supplies their discovery metadata.

The bottom status bar includes DS, FMS, controller, and power dots plus RIO CAN utilization. Green means the published boolean is true (POWER means no brownout), red means false, and gray means unavailable or stale. Controller status checks the configured driver joystick port; fresh templates use `Constants.OI.DRIVER_CONTROLLER_PORT`. Existing integrations can call `withDriverControllerPort(port)`; its default is port 0. RIO CAN reports utilization of the roboRIO CAN bus.

## Autonomous

The tab uses PowerLib AutoBuilder's `/SmartDashboard/Auto Chooser` exclusively. Register routines through `frc.powerlib.auto.AutoBuilder` and call `publish()` after registration. The selector disappears if AutoBuilder has not published a valid chooser.

AutoBuilder filters options using the Driver Station alliance: red shows red-specific and unrestricted routines; blue shows blue-specific and unrestricted routines. When alliance is unknown, only unrestricted routines are shown. The built-in `None` remains available. Register unrestricted routines with `addAuto(name, factory)` and alliance-specific routines with `addAuto(name, Alliance.Red, factory)` or `Alliance.Blue`. The dashboard displays the robot's published options directly. AutoBuilder refreshes them when alliance changes and resolves an unavailable selection to the available default, or `None` when the configured default is unavailable.

Selection writes `<chooser>/selected`. The display follows the robot's `<chooser>/active` acknowledgement and reports a missing acknowledgement after three seconds. Changes are locked while enabled, disconnected, stale, or when the chooser explicitly publishes `.controllable=false`. A live `Enabled=false` and Drive heartbeat are required; a missing enabled state does not count as disabled. The team's robot remains responsible for deciding which autonomous command runs.

Crew tools also exports a local JSON telemetry snapshot, including binary topic bytes. Robot-specific driver bindings are deliberately left for each team to define.

## Validation

Run `npm run check:drive` for discovery, URL, chooser, freshness, validity, struct-pose, and clock checks. Run `npm run build` for renderer and Electron compilation. Live verification uses an isolated NT4 server and MJPEG fixtures; actual robot cameras should also be checked on the team's network before competition.
