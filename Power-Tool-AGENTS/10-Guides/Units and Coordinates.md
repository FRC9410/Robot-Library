---
title: Units and Coordinates
date: 2026-10-30
tags: [guide, units, coordinates]
---

# Units and Coordinates

## Mechanism units (Phoenix 6)
PowerLib passes values straight to CTRE controls, so the units are Phoenix's **mechanism
rotations** after the feedback ratios are applied.

| Quantity | Unit | Where |
|---|---|---|
| Velocity, velocity setpoint | mechanism **rotations per second** (rps) | `VelocitySubsystem.setVelocity(rps)`, data `Velocity`/`VelocitySetpoint` |
| Position (absolute) | mechanism **rotations** | `setPositionRotations`; `setPositionDegrees(deg)` = deg/360 |
| Position (relative) | mechanism **rotations**, as defined by `sensorToMechanism` | `setPosition(p)` |
| Motion Magic cruise velocity | rps | `motionMagic.cruiseVelocity` |
| Motion Magic acceleration | rps² (rotations per second²) | `motionMagic.acceleration` |
| kS, kG / kV / kA (voltage control) | volts / volts per rps / volts per rps² | `LeadMotorConfig` |
| Torque feedforward (velocity-torque, FOC) | amps | `torqueFF` |
| Stator current limit | amps | `statorCurrentLimitAmps` |
| CANcoder magnet offset / discontinuity | rotations ([-1,1] / [0,1]) | `cancoder` |

### Feedback ratios
- `rotorToSensor` = motor rotor rotations per **sensor** rotation. It only matters with a fused CANcoder (absolute position). Leave it at 1 otherwise.
- `sensorToMechanism` = sensor rotations per **mechanism** rotation. Without a CANcoder, the sensor is the rotor.
- Both must be non-zero with |ratio| ≤ 1000. Negative values are allowed.

### The `units` label does not convert anything
`absolutePosition.units` and `relativePosition.units` are **labels only**. They're attached to
logged `Position`/`Setpoint` values and shown in Power Tool. Changing `"rotations"` to
`"inches"` does **not** rescale targets, soft limits, tolerance or Motion Magic values.

To really control in inches on a relative mechanism:
1. Set `sensorToMechanism` to *motor rotations per inch* (within the ±1000 limit).
2. Re-enter home, soft limits, tolerance and Motion Magic values in inches (in/s, in/s²).
3. Then set the label to `"inches"`.

## Drivetrain units
| Quantity | Unit |
|---|---|
| Pose X/Y | meters |
| Heading in the JSON frame (`Drive.Pose.headingRadians`) | radians |
| `Drive/Pose/HeadingDegrees`, `HeadingSetpointDegrees` | degrees |
| Swerve angular rates (`*MaxAngularRateRadiansPerSecond`) | rad/s |
| Translation deadband | m/s |
| Vision yaw rate limits, heading error limits | degrees/s, degrees |
| Vision timestamps | FPGA seconds (`Utils.fpgaToCurrentTime` before CTRE history lookups) |

## Field coordinates
- **Blue-origin WPILib coordinates everywhere:** origin at the blue alliance wall corner, +X down the field, +Y to the left from blue, heading CCW-positive.
- Limelight inputs use `botpose_wpiblue` and `botpose_orb_wpiblue`, which are already blue-origin.
- `Auto.withAlliance(...)` filters routines; it does **not** mirror coordinates. Red-side autos need red-side coordinates.
- `DriveUtil.calculateDriveToPointVelocity` takes a `directionMultiplier` (−1 blue, +1 red).

## Field dimensions
Two separate numbers, currently **different**:

| Setting | Value | Used for |
|---|---|---|
| Power Tool `drive-template.json` (`field.lengthMeters/widthMeters`) | 16.54 × 8.07 m | **Drawing only:** the Drive tab field view. Each viewer can override it in Crew tools (saved in localStorage). |
| Robot `LocationConstants` (`X_MAX`, `Y_MAX`) | 17.548 × 8.052 m | **Vision safety:** `VisionPoseFilterConfig.forField(...)` rejects camera poses outside these bounds + 0.25 m. |

They aren't linked. Each season, set `LocationConstants` to the official field size, because wrong
bounds reject good vision frames or accept bad ones. Then match the dashboard (Crew tools, or
`drive-template.json` for everyone) so the drawn robot lines up.

Related: [Configuration Examples](Configuration%20Examples.md), [Mechanism Behavior](../03-PowerLib/Mechanism%20Behavior.md), [Vision Pipeline](../03-PowerLib/Vision%20Pipeline.md), [Glossary](../01-Overview/Glossary.md)
