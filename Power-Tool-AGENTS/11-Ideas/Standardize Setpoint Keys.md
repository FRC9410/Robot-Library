---
title: Standardize Setpoint Keys
date: 2026-10-30
tags: [idea, log-viewer, powerlib]
status: proposed
---

# Standardize Setpoint Keys

**Status:** Proposed, 2026-10-30.

## Idea
The setpoint key names differ by subsystem type:

| Subsystem | Value key | Setpoint key |
|---|---|---|
| `VelocitySubsystem.java` | `Velocity` | `VelocitySetpoint` |
| `AbsolutePositionSubsystem.java` | `Position` | `SetpointRotations` |
| `RelativePositionSubsystem.java` | `Position` | `Setpoint` |

Either rename them all to `<Signal>Setpoint` (e.g. `PositionSetpoint`), or keep a small lookup
table in the viewer.

## Why
[Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md) overlays each value
with its setpoint. A consistent naming rule makes that pairing automatic.

## Open questions
- Renaming changes log keys. `robotModel.ts` and the Drive mechanism cards may read these names; check every reader first.

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Subsystems and IO](../03-PowerLib/Subsystems%20and%20IO.md)
