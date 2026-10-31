---
title: Configs
date: 2026-10-30
tags: [powerlib, configs]
---

# Configs

Immutable records in `templates/powerlib/src/main/java/frc/powerlib/configs/`. Each one validates
itself in its constructor, so a bad value fails at robot startup instead of misbehaving later. The
generator writes the subsystem configs into `constants/<Name>Constants.java`
([Subsystem Generator](../02-Install-and-Update/Subsystem%20Generator.md)).

## Subsystem configs
| Record | Key fields |
|---|---|
| `MotorConfig` (class) | `canId` 0–62, `neutralMode`, `isFollower`, `isReversed`. Factories `leader(...)`, `follower(...)` |
| `LeadMotorConfig` | `kP kI kD kG`, `Optional kS kV kA`, `sensorToMechanismRatio`, `rotorToSensorRatio`, `focEnabled` |
| `MotionMagicConfig` | `cruiseVelocity`, `acceleration` (≥ 0) |
| `CancoderConfig` | `encoderId`, `magnetOffsetRotations` [-1,1], `discontinuityPointRotations` [0,1] |
| `VelocitySubsystemConfig` | motors, lead, motion magic, name, `torqueFeedForward`, `Optional statorCurrentLimitAmps` |
| `AbsolutePositionSubsystemConfig` | + `cancoderConfig`, `units`, `Optional defaultPosition` |
| `RelativePositionSubsystemConfig` | + `slowMotionMagicConfig`, `units`, `homePosition`, soft limits, `tolerance`, `stopVoltage` |

## Vision configs
Used by [Vision Pipeline](Vision%20Pipeline.md):

| Record | `DEFAULT` / factory |
|---|---|
| `LimelightVisionConfig` (MegaTag2 position) | `(0.07 base std dev, 6.25 m max tag distance, 0.5 s max age)` |
| `LimelightHeadingConfig` (MegaTag1 heading) | `(20° std dev, 4 m, 0.2 s, 45°/s max yaw rate, 180° stationary / 45° moving error limit, 0.2 ambiguity)` |
| `VisionHeadingInitializationConfig` | `(enabled, 0.25 s stable, 5 frames, 2° spread, 0.05 m/s, 5°/s, 0.5 s feedback age)`; `withEnabled(false)` |
| `VisionPoseFilterConfig` | `forField(minX, maxX, minY, maxY)`: 0.25 m margin, 0.5 m max height, 8° tilt, 0.15 s settle, 1 m single correction, 3 frames / 0.1 s / 0.25 m recovery |

## `ConfigValidation`
Shared checks: finite, positive, range, feedback ratio (non-zero, |x| ≤ 1000), subsystem name
(no `/`), and motor lists (no duplicate CAN IDs, at least one leader).

Related: [Subsystems and IO](Subsystems%20and%20IO.md), [Vision Pipeline](Vision%20Pipeline.md), [Subsystem Generator](../02-Install-and-Update/Subsystem%20Generator.md)
