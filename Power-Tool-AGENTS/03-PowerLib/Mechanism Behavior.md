---
title: Mechanism Behavior
date: 2026-10-30
tags: [powerlib, subsystems, reference]
---

# Mechanism Behavior

How the PowerLib mechanisms react to commands, failures and tuning. Complements
[Subsystems and IO](Subsystems%20and%20IO.md). Sources: `frc/powerlib/subsystems/*.java` and the
"Runtime contracts" section of `tests/README.md`.

## Startup and configuration failures
- **At construction:**
  - Each TalonFX (and CANcoder) gets its full configuration with a **50 ms timeout**.
  - Any non-OK result sets `isConfigured()` to false **permanently** (until the subsystem is recreated, i.e. robot restart) and reports `PowerLib <name> startup config for <device> failed: <status>` to the Driver Station.
- **While unconfigured:**
  - `setVelocity`, `setPositionRotations`, `setPosition` and `setVoltage` **do nothing**.
  - Stop commands still work (`stopVelocity`, `stopPosition`, `stop()`, `stopAll`, `setOutput(id, 0)`).
- **Sim / injected IO:** no hardware is created, so no startup failure is possible. `HealthChecks.mechanismHealthy` still returns false for an unconfigured mechanism.
- **Common causes:** wrong CAN ID, wrong bus (all devices are created on `canivore`), device not powered, or firmware mismatch.

## Velocity and VelocityTorque
- `setVelocity(rps)`: stores the setpoint and sends the request immediately. There's no acknowledgement step.
- `stopVelocity()`: commands **velocity 0** (actively held). `brake()`: sends `NeutralOut` (motor goes to its neutral mode).
- `isRunning()`: configured and |measured velocity| > 0.1 rps. **It doesn't mean "at setpoint".** For a readiness check, compare `inputs.velocityRotationsPerSecond` with `getVelocitySetpoint()` yourself.

## AbsolutePosition
- **At startup:** the CANcoder is configured, its signals are set to 100 Hz, and the arm moves to `defaultPosition` (or holds the current position if none is set).
- `setPositionRotations` / `setPositionDegrees`: sent immediately.
- `stopPosition()`: zero output.
- `Position/Default` is tunable but only updates a private field. It doesn't move the mechanism.

## RelativePosition: requested vs. activated setpoints
This is the only mechanism with **profile acknowledgement**:
1. `setPosition(p)` records the **requested** setpoint (`getSetpoint()`) and picks a profile:
   - **SLOW** (`slowMotionMagic`) when `p ≤ current position`;
   - **NORMAL** otherwise.
2. If that profile's Motion Magic config isn't confirmed on the TalonFX yet, it's written through the `ConfigurationQueue`, and the mechanism **holds its current position** in the meantime. In that state `getActivatedSetpoint()` = current position and `positionPending` = true.
3. Once the write is acknowledged, the target is sent (`getActivatedSetpoint()` = `p`).
   - A failed write stays pending and retries no sooner than 500 ms later.
   - A newer `setPosition` replaces the target, and only the latest one is released.
4. `atTargetPosition()` = configured AND in position mode AND nothing pending AND |position − setpoint| < `tolerance`.
5. `isReady()` = `atTargetPosition()` AND the setpoint is `homePosition`.

**Cancelling pending motion.** These all clear pending targets and leave position mode:
- `stop()`: applies `stopVoltage`.
- `setVoltage(v)`: manual open-loop.
- `setOutput` / `stopAll`.
- `zeroEncoder(p)`: stops the old demand *first*, then re-zeros.

After a cancel, sending the same target again resumes control.

**Startup:**
- The constructor calls `zeroEncoder(homePosition)`, which declares the **current** encoder reading to be `homePosition`, and then targets that coordinate. It's a coordinate reset, not a homing routine: nothing moves the mechanism to a hard stop or limit switch.
- If the mechanism isn't physically at home at boot, every position (soft limits included) is offset by that error until you call `zeroEncoder(...)` at a known position.

**`slowThreshold`** stays in the JSON, constructor and record for compatibility, but its accessor
is `@Deprecated` and **nothing reads it**. Profile choice depends only on direction (down/equal →
SLOW). Changing it has no effect.

**Live tuning:** changing any Motion Magic or slow Motion Magic value forces the active profile to
be re-applied. Changing FOC re-sends the current target.

## Live tuning (all mechanisms)
- Runs only when tuning is enabled AND the mechanism's own 5 Hz cadence is due.
- Invalid values (non-finite, out of range, zero ratio…) are rejected. The previous value is kept and a warning is shown once per distinct bad value.
- CTRE config groups (Slot0, Feedback, MotionMagic, MotorOutput) go through `ConfigurationQueue`. **Cached values only update after the device acknowledges the write.**
- `Motors/<id>/BrakeMode` and `Reversed` reconfigure motor output. Followers are re-aligned instead of inverted.

## Simulation
`MechanismSimulation` is a deterministic 20 ms model (Kraken X60 free speed, Motion Magic limits,
soft limits). It ignores PID gains. Use it to test logic and readiness, not tuning.

Related: [Subsystems and IO](Subsystems%20and%20IO.md), [Configs](Configs.md), [Units and Coordinates](../10-Guides/Units%20and%20Coordinates.md), [Adding a Robot State](../10-Guides/Adding%20a%20Robot%20State.md), [Troubleshooting](../10-Guides/Troubleshooting.md)
