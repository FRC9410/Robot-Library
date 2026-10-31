---
title: Shared Data Store
date: 2026-10-30
tags: [powerlib, telemetry, tuning]
---

# Shared Data Store

`frc.powerlib.PowerRobotContainer` (public interface of static methods) and its private backing
store `PowerDataStore` are the hub every subsystem writes to. Telemetry and tuning both read from it.

Files: `templates/powerlib/src/main/java/frc/powerlib/PowerRobotContainer.java`, `PowerDataStore.java`

## What it holds
Four groups. Each is a `HashMap<owner, HashMap<key, value>>` with read-only views:

| Group | Written by | Read by |
|---|---|---|
| **data** (latest value per metric) | `setData`, `setSubsystemData` | `SubsystemTelemetry` (NT frame and SignalLogger) |
| **units** (string per metric) | the optional `units` argument | SignalLogger `writeDouble` only. **Not in the NT JSON.** |
| **subsystem variables** (tunables) | `setSubsystemVariableDefault`, `updateSubsystemVariable` | mechanisms, `TunableConstants`, `PowerDashboard` NT sync |
| **command variables** | `setCommandVariableDefault`, … | `PowerDashboard` NT sync |

Plus a `tuningEnabled` flag (`setTuningEnabled` / `isTuningEnabled`).

## Write API
- `setSubsystemData(owner, key, value[, units])`: owner = subsystem name. Passing no units keeps the existing unit.
- `setData(key, value[, units])`: splits `key` at the first `/` into owner and key. Without a usable slash, the owner is `Robot`.
- `PowerSubsystem.setSubsystemData(key, value[, units])`: protected helper that uses the subsystem's name as owner.
- Values: `Boolean`, `Number`, `String`, `Pose2d`, `null`. Other objects are stringified.

## Rules
- **Single thread.** The first thread to touch the store owns it; calls from any other thread throw `IllegalStateException`.
- Owner names must be non-blank and contain no `/`. Keys may contain `/` (e.g. `Pose/XMeters`).
- `Drive/Pose` must be a `Pose2d` or null.
- Variables: reading with a fallback registers the key. A **revision** counter goes up only when a new key appears, which tells `PowerDashboard` to republish.
- Last write wins. The store keeps only the latest value; history lives in the logs.

Related: [Telemetry and Logging](Telemetry%20and%20Logging.md), [Tuning](Tuning.md), [Subsystems and IO](Subsystems%20and%20IO.md), [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md)
