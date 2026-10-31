---
title: Tuning
date: 2026-10-30
tags: [powerlib, tuning, networktables]
---

# Tuning

Live-editable values. The PowerLib pieces are in `frc/powerlib/tuning/`. **The NT side of tuning
lives in the template `PowerDashboard.java`, not in PowerLib.** End-to-end flow:
[Tuning Round Trip](../06-Data-Flows/Tuning%20Round%20Trip.md).

## Pieces
- **`@TunableConstant`:** marks a `public static volatile` numeric field in a `*Constants.java`. The generator adds it to numeric constants.
- **`TunableConstants`:**
  - `register(XConstants.class)` binds each marked field to the variable `<Owner>/Custom/<FIELD>`, where owner = class name minus `Constants`.
  - `sync()` writes changed NT values back into the fields by reflection, converting types (int range checks and so on). An invalid value reverts to the startup default.
  - `GeneratedTunableConstants.register()` (generated) lists the classes.
- **`TuningCadence`:** `INTERVAL_SECONDS = 0.2`, so tuning work runs at most 5 Hz. One instance each per mechanism, `DriveUtil`, `TunableConstants` and `Swerve`.
- **Variables** in the [Shared Data Store](Shared%20Data%20Store.md):
  - `setSubsystemVariableDefault(owner, key, value)` registers a variable;
  - `getSubsystemVariable(owner, key, fallback)` reads it.

## NT topics (template `PowerDashboard`)
| Topic | Direction | Meaning |
|---|---|---|
| `/PowerLib/Tuning/RequestedEnabled` | dashboard → robot | Tuning switch request |
| `/PowerLib/Tuning/Enabled` | robot → dashboard | Acknowledgement; live edits only count while this is true |
| `/PowerLib/Subsystems/<Owner>/Variables/<key>` | both | Subsystem tunables, e.g. `Swerve/Variables/Heading/kP`, `Intake/Variables/PID/kP`, `Vision/Variables/Custom/X` |
| `/PowerLib/Commands/<Owner>/Variables/<key>` | both | Command tunables |
| `/PowerLib/Characterization/<Sub>/<Cmd>/{.type,name,request,running}` | both | SysId command triggers |

- Every 0.2 s: sync the switch, then sync variables. A variable group syncs only when tuning is on, or when new keys were registered (so new tunables still show up).
- **Tuning off:** NT values are ignored, the last applied values stay, and apply code is skipped.
- **Restart:** values return to the Java defaults. Keep changes with *Save Tuned Values* → *Update Code* → deploy.

Related: [Tuning Round Trip](../06-Data-Flows/Tuning%20Round%20Trip.md), [Shared Data Store](Shared%20Data%20Store.md), [Subsystems and IO](Subsystems%20and%20IO.md), [NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md)
