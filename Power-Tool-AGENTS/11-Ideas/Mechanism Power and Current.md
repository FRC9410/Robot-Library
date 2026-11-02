---
title: Mechanism Power and Current
date: 2026-11-02
tags: [idea, log-viewer]
status: decided
---

# Mechanism Power and Current

**Status:** Decided and built, 2026-11-02, reading the motor logs (not the PowerLib-logging alternative). Tested on the 2026 MOSE Q8 match: rio + CANivore files merged, 18 motors.

## Idea
Show how much current, voltage and power each mechanism uses:
- **On each mechanism graph:** a selector for what to plot: value vs setpoint (today), supply current (A), power (W = supply voltage × supply current, summed over its motors), applied motor voltage (V), or motor temperature.
- **A power widget:** each mechanism's power stacked over time, with battery voltage. It shows who was drawing the most when the battery sagged or browned out.

## What the logs already have (checked 2026-11-02)
- Phoenix auto-logs every Talon FX into the `.hoot` for its CAN bus. Owlet exports them as `Phoenix6/TalonFX-<CAN ID>/<Signal>` with units in the metadata. Signals include `SupplyCurrent`, `SupplyVoltage`, `MotorVoltage`, `StatorCurrent`, `TorqueCurrent`, `DeviceTemp` and PID terms.
- The team's 2026 CANivore log (MOSE Q8) is Pro-licensed, so all of those export: 18 Talon FXs, 6 CANcoders, 1 Pigeon. Without Pro, `SupplyCurrent` and `SupplyVoltage` are still on CTRE's free list.
- PowerLib itself logs only value and setpoint per mechanism, with no current or voltage.

## What it needs
1. **Which motors belong to which mechanism.** `powerlib-subsystems.json` lists each subsystem's motor CAN IDs. The drivetrain's IDs come from the Swerve config. Older (pre-PowerLib) logs would need a way to assign motors in the viewer, or just show per-motor graphs.
2. **Opening a whole match, not one file.** Mechanism values are in `rio_*.hoot`, while CANivore motors are in the long-ID `.hoot`. The viewer would open both from the same session folder and merge them on one timeline. CAN IDs can repeat across buses, so each motor is tracked per bus. (This is also an open question in [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md).)

## Grouping motors automatically (2026-11-02)
Assigning 18 motors by hand on every log was too slow, so motors now group themselves when a log opens:
- from `powerlib-subsystems.json` (mechanisms) and `TunerConstants.java` (Drive) when Power Tool can read them;
- otherwise by **matching motion**: each motor's position (or speed, for velocity mechanisms) is correlated with each mechanism's value while enabled, and the motor joins its best match above 0.9;
- leftover IDs 1–8 (the template's swerve IDs) become a guessed "Drive" when no TunerConstants is found.

On MOSE Q8 this grouped all 18 motors with no setup: 10 by motion (scores 0.989–1.000: Shooter 51–53, Hood 50, Intake Roller 20, Wrist 21–22, Spindexer 30, Feeder 40–41), and IDs 1–8 guessed as Drive. Feeder and Spindexer run together (0.992 across), but each motor's best match still separated them. The Assign motors dialog remains for fixing mistakes and shows how each motor was grouped.

## Alternative: log it from PowerLib
Each mechanism could add its total supply current and applied voltage to its shared-map data (e.g. `SupplyCurrentAmps`, `AppliedVolts`). That gives the mapping for free and works from one file. It also shows live in Power Tool and works without Pro. The cost: more StatusSignals read every loop, more CAN traffic, and a template change. It wouldn't help logs that already exist.

## Open questions
- Motor assignments are saved per laptop (localStorage). Should they move into `power-tool/generated/` so they travel with the robot project?
- [x] The drivetrain's motor IDs: now read from `TunerConstants.java`, with the 1–8 guess as a fallback.
- Mechanisms that never move during a match (e.g. a hood that stayed put) can't be matched by motion; their motors stay unassigned.
- Memory: a full match with motors uses ~400 MB in the renderer. Storing numeric signals in typed arrays would cut that a lot.
- Decided: "current" means supply current (battery draw); stator current is its own view. The drivetrain is one "Drive" group.

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Mechanism Picker](Mechanism%20Picker.md), [Problem Markers](Problem%20Markers.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
