---
title: Vision Pipeline
date: 2026-10-30
tags: [powerlib, vision, limelight]
---

# Vision Pipeline

Multi-Limelight pose correction. The PowerLib classes in `frc/powerlib/vision/` are reusable
building blocks; the template `Vision.java` wires them to `Swerve`. The step-by-step loop is in
[Vision to Pose Flow](../06-Data-Flows/Vision%20to%20Pose%20Flow.md). Detailed behavior rules are
in the "Multiple Limelights" section of `README.md` and in `tests/README.md`.

## Two signals per camera
| | MegaTag2 (`botpose_orb_wpiblue`) | MegaTag1 (`botpose_wpiblue`) |
|---|---|---|
| Used for | **X/Y position** | **heading** (slow drift correction) |
| Std devs | `(σ, σ, huge)`; ignores heading | `(huge, huge, 20°)`; ignores X/Y |
| σ | `0.07 · avgDist² / tagCount` | fixed 20° |
| Needs | 1+ tags, avg distance < 6.25 m, age ≤ 0.5 s | 2+ tags (or strict single-tag), ≤ 4 m, ≤ 0.2 s, yaw rate ≤ 45°/s, ambiguity ≤ 0.2 |

## Classes
- **`LimelightVision`:** reads every camera and returns ranked candidates.
  - Publishes `robot_orientation_set` to each camera (needed for MegaTag2), along with `imumode_set` and `throttle_set`.
  - Every new frame is consumed even if rejected, so old frames never replay.
  - Ranking:
    - position: lowest σ, then newest;
    - heading: multi-tag first, then distance²/tags, then ambiguity, then tag span, then newest.
  - Configured camera order breaks ties.
- **`VisionPoseFilter`:** gates frames.
  - Robot must be level: tilt ≤ 8° for 0.15 s, with fresh gyro data.
  - Frame must be inside the field bounds + 0.25 m, with height ≤ 0.5 m.
  - Corrections > 1 m need 3 agreeing frames over 0.1 s (wheel-slip recovery without trusting one outlier).
- **`VisionMeasurementFusion`:** feeds accepted samples to the pose estimator in **capture-time order**.
  - When a delayed sample arrives, it replays the newer ones.
  - Position samples keep historical heading; heading samples keep historical X/Y.
  - Tracks timestamps per camera.
- **`VisionHeadingInitializer`:** while stationary, collects a stable window per camera.
  - Multi-tag: 5 frames over 0.25 s within 2°.
  - Single-tag: 10 frames over 0.5 s within 1°.
  - Produces the heading for a hard reset.
- **`VisionHeadingReadiness`:** confirms heading converged through gradual fusion (5 frames over 0.25 s within 5°), including while moving.
- **`VisionHeadingSelector`:** sticks with one heading camera. A challenger needs sustained better geometry (5 frames over 0.25 s) to take over.

## Behavior by mode
Taken from `applyMeasurements`, `recoverStationaryHeading` and `applyHeadingCorrections` in the
template `Vision.java`. **Stationary** = translation ≤ 0.05 m/s and yaw rate ≤ 5°/s
(`VisionHeadingInitializationConfig`).

| Situation | MT2 position fusion | Gradual MT1 heading fusion | Hard heading reset | Single-tag heading |
|---|---|---|---|---|
| Corrections off (`setShouldUpdatePose(false)`) | ❌ | ❌ | ❌ | ❌ (frames still consumed and cached for manual seed) |
| Heading **not yet established** (any mode) | ❌ waits | Enabled only. 5 agreeing frames within 5° over 0.25 s **establish** heading (no snap) | ✅ when stationary with a stable window | Stationary only, strict window |
| **Disabled**, heading established | ✅ | ✅ | ✅ if stationary, stable, and error > 5° | ✅ if qualified |
| **Enabled, stationary** | ✅ | ✅ error limit 180° | ✅ if stable and error > 5° | ✅ if qualified (10 frames / 0.5 s / 1°, ≤ 2 m, ambiguity ≤ 0.05) |
| **Enabled, moving** | ✅ | ✅ **multi-tag only**, error limit 45° | ❌ never snaps while moving | ❌ |
| **Test mode** | ✅ if established | ❌ | ❌ | ❌ |
| Drivetrain feedback stale (`driveHealthy` false) | filter-dependent | ✅ | ❌ ("Waiting for fresh drivetrain feedback") | — |
| `HEADING_INITIALIZATION_CONFIG.withEnabled(false)` | ✅ from boot (heading trusted immediately) | ✅ | ❌ never | stationary qualification still applies |

Every mode also requires:
- the robot to be level (tilt ≤ 8°, settled for 0.15 s) at capture time;
- frames to be fresh;
- positions inside the field bounds;
- corrections > 1 m to be confirmed by 3 agreeing frames.

### Troubleshooting with the logs
These are SignalLogger strings (not on the dashboard), so read them from the robot log:

| Key | Values and meaning |
|---|---|
| `Vision/Position/Status` | `Vision corrections disabled` · `Waiting for absolute heading initialization` (heading not trusted yet) · `Waiting for level gyro feedback` / `Waiting for fresh gyro feedback` / `Waiting for level settling` / `Rejected tilted robot` (tilt gate) · `Rejected stale or future position` · `Rejected capture, position bounds or missing pose history` (outside the field or bad `LocationConstants`) · `Waiting for consistent large position correction` (> 1 m jump being confirmed) · `Accepted position` / `Accepted consistent position recovery` |
| `Vision/Heading/Status` | `No fresh reliable heading` · `Test mode` · `Waiting for fresh drivetrain feedback` · `Waiting for stationary robot` · `Waiting for stable MT1 heading` / `Collecting consistent MT1 heading` · `Rejected inconsistent stationary heading` · `Heading error exceeds limit` · `Independent heading applied` · `MT1 heading initialized` · `Stationary single-tag/two-tag heading recovered` · `Automatic heading initialization disabled` |
| `Vision/Heading/ErrorDegrees` | Camera heading minus estimator heading at capture time (NaN when unavailable) |
| `Vision/Heading/Accepted`, `Vision/Heading/Camera`, `Robot/Control/Action` | Whether a heading correction happened this loop, which camera, and hard-reset/confirmation events |

Common paths:
- **Never leaves "Waiting for absolute heading initialization":** no 2-tag view while stationary, or the robot was never still long enough. Park facing two tags while disabled.
- **"Rejected capture, position bounds…" constantly:** check `LocationConstants` against the real field, the camera mounting pose in the Limelight UI, and the field map.
- **"Heading error exceeds limit" while moving:** the camera disagrees by more than 45°. Check gyro signs and camera yaw.

## Template `Vision.java` API
- `setShouldUpdatePose(bool)`: turn corrections on or off.
- `seedFromFreshVision()`: manual reset while disabled.
- `isHeadingEstablished()`.
- `hasFreshAcceptedMeasurement()`: use this for confidence checks.

SignalLogger keys (no dashboard fields): `Vision/Position/Status`, `Vision/Heading/{Accepted, Status, ErrorDegrees, PigeonYawDegrees, EstimatedDegrees, Camera}`, `Robot/Control/Action`.
See [Telemetry and Logging](Telemetry%20and%20Logging.md).

Related: [Vision to Pose Flow](../06-Data-Flows/Vision%20to%20Pose%20Flow.md), [Configs](Configs.md), [Health, Math and Utils](Health,%20Math%20and%20Utils.md), [Tests and Checks](../07-Testing/Tests%20and%20Checks.md)
