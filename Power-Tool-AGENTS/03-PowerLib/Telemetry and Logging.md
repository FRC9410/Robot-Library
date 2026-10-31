---
title: Telemetry and Logging
date: 2026-10-30
tags: [powerlib, telemetry, logging, signallogger, log-viewer]
---

# Telemetry and Logging

**The most important note for the log viewer.** It covers what the robot records, where, how often,
and in what format. Folder: `templates/powerlib/src/main/java/frc/powerlib/dashboard/`.
Contract: `tests/TELEMETRY-CONTRACT.md`. Diagram: [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md).

## Per-loop order (template `PowerDashboard.periodic()`, every 20 ms)
1. `driveTelemetry.publish()`: writes `Drive/*` into the shared data map.
2. `syncTuningMode()`
3. `SubsystemTelemetry.publish()`: **logs every loop, publishes NT every 100 ms**.
4. `robotLogTelemetry.log()`: log-only robot status.
5. `syncTuningValues()`
6. `pollCharacterizationCommands()`

## `SubsystemTelemetry` (static)
Reads `PowerRobotContainer.getAllSubsystemData()` and sends it to two places:

| Destination | Rate | Format |
|---|---|---|
| **SignalLogger** (CTRE `.hoot` log) | every call = **50 Hz** | one signal per metric: `PowerLib/Subsystems/<owner>/Data/<key>` |
| **NT `/PowerLib/Data`** | **10 Hz** (`PUBLISH_INTERVAL_SECONDS = 0.1`) | one JSON string (type string `"json"`) |
| **NT `/PowerLib/Subsystems/Drive/Data/Pose`** | 10 Hz | `Pose2d` struct for AdvantageScope; only valid poses |

SignalLogger value mapping:
- `Pose2d` (and the `Drive/Pose` key): `writeStruct(name, Pose2d.struct, pose)` **only if valid**. Invalid poses write nothing.
- `Boolean` → `writeBoolean`.
- `Number` → `writeDouble(name, value, units)`. **NaN is logged as NaN.**
- anything else → `writeString` (null → `""`).

JSON frame (`schemaVersion: 1`):
```json
{ "schemaVersion": 1, "sequence": 42, "timestampSeconds": 123.4,
  "subsystems": { "Drive": { "BatteryVolts": 12.3, "Pose": {"xMeters":1,"yMeters":2,"headingRadians":0.5}, "Pose/XMeters": 1.0 },
                  "Intake": { "Velocity": 40.1, "VelocitySetpoint": 40.0 } } }
```
In the JSON, non-finite numbers become `null` and other objects use `toString()`. **Units are
not included in the JSON**; they exist only in the log.

## `DriveTelemetry` (owner `Drive`)
Collects into the shared map; it never writes to NT or the log itself.

| Key | Type / units |
|---|---|
| `Enabled` | boolean |
| `Mode` | `DISABLED` / `AUTO` / `TEST` / `TELEOP` |
| `Alliance` | string |
| `MatchTimeSeconds` | seconds |
| `BatteryVolts` | volts |
| `RioCanUtilization` | fraction |
| `RequestedState`, `ActualState` (`State` unused) | string |
| `PoseValid` | boolean |
| `Pose` | `Pose2d` or null |
| `Pose/XMeters`, `Pose/YMeters` | meters, NaN when invalid |
| `Pose/HeadingDegrees` | degrees, NaN when invalid |
| `HeadingSetpointDegrees` | degrees, NaN = no target |
| `Heartbeat` | increments every call |

## `RobotLogTelemetry`: log only, never on NT
Writes directly to SignalLogger at 50 Hz under `PowerLib/RobotStatus/`:
- `DsAttached`, `FmsAttached`, `DriverControllerConnected`, `BrownedOut` (booleans);
- `AutoStatus`, `AutoReason` (strings). These need `withAutonomousStatus(...)`, which the template doesn't call, so **they're not logged by default**.

## Other SignalLogger keys in the templates
- `Vision.java`:
  - `Vision/Position/Status`;
  - `Vision/Heading/Accepted`, `Status`, `PigeonYawDegrees`, `EstimatedDegrees`, `ErrorDegrees` (may be NaN), `Camera`;
  - `Robot/Control/Action`.
- `Swerve.java` (only while SysId routines run): `SysIdTranslation_State`, `SysIdSteer_State`, `SysIdRotation_State`, `Rotational_Rate`.
- Generated `<Name>Characterization.java` SysId routines also log through SignalLogger.
- Phoenix itself auto-logs device signals into the same `.hoot` files.

## Facts that matter for the log viewer
- **Nothing in `templates/` calls `SignalLogger.start()` or `setPath()`.** Recording follows Phoenix defaults: it auto-starts when an FMS match is detected, and logs land on the roboRIO (USB stick if present, otherwise `/home/lvuser/logs`). So **practice sessions without an FMS record nothing** unless code calls `SignalLogger.start()`. PowerLib's 50 Hz `write*` calls are dropped while the logger isn't running. Confirm on the robot (see the check in [First Robot Walkthrough](../10-Guides/First%20Robot%20Walkthrough.md)).
- The logs are **CTRE `.hoot`** files. Owlet (CTRE's CLI) or Phoenix Tuner can export them to `.wpilog`/CSV; AdvantageScope reads `.wpilog`.
- Power Tool keeps **no history**; it only shows the latest NT value. The only export is the Drive tab's one-shot JSON snapshot.
- The NT frame (10 Hz) is a lighter, lower-rate copy of the same map, so a viewer could also record NT live.

Related: [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md), [Shared Data Store](Shared%20Data%20Store.md), [NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md), [Log Viewer Project](../09-Changelog/Log%20Viewer%20Project.md)
