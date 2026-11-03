---
title: Project Overview
date: 2026-11-03
tags: [index, project, idea, log-viewer, power-tool]
aliases: [Ideas, Log Viewer Project, Roadmap]
---

# Project Overview

Where Power Tool's log viewer (the **Logs** tab) stands, what's next, and what's still open.
How the built parts work is in [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md#logs-featureslogs);
what changed and when is in the [CHANGELOG](../09-Changelog/CHANGELOG.md). Next season's work is in
[2027 and Systemcore Readiness](2027%20and%20Systemcore%20Readiness.md).

Branch: `feature/Log-Viewer` (last pushed 2026-11-03).

## Built
| Feature | What it does |
|---|---|
| **Reading logs** | Opens `.wpilog` directly and `.hoot` through CTRE's Owlet (the one matching the log's format version, from AdvantageScope's cache). A `.hoot` opens every CAN bus file from the same run. |
| **Logs list** | Open log shows a popup of the logs folder (default `Documents\Power Tool\Logs`), grouped by event, Matches first, with search, time and size. With a log open, the same list is a drawer. Matches are named from Phoenix's file names ("Qual 6"). |
| **Get logs from robot** | Greyed out until the robot answers on SSH; lists its runs and downloads them over SFTP into the logs folder. Tested against the fake robot (`scripts/fake-robot.mjs`), **not yet on the real robot**. |
| **Layout** | Three columns: subsystem graphs, the field standing up (driver side at the bottom), the Power card. Fits 1280x720 and 1920x1080 without page scrolling. |
| **Subsystem graphs** | Pick several subsystems; each graph shows value vs. setpoint, or current, power, voltage, stator or temperature, with every motor as a thin line under the average. |
| **Power and current** | Phoenix motor signals grouped by subsystem (config, `TunerConstants.java`, then matched by motion), with an Assign motors dialog. |
| **Playback** | One timeline drives everything; match periods (auto/teleop) as chips; setpoint error, overshoot and settle time. Problem markers (brownouts, CAN spikes, setpoint misses) are computed but hidden to save space. |
| **Shared state** | The open log lives in a context above the tab; the last 3 logs opened from the list stay loaded. |

Widgets are picked by data shape and PowerLib's key names, never by the game, so a new robot gets graphs without code changes.

## Next
Not built. Roughly in the order they'd help most.
- **Try Get logs from robot on the real robot.** Confirms the `lvuser` login and the log folders.
- **Driver Station logs:** brownouts, packet loss and voltage from the DS, matched to each robot log. The 2027 DS writes `.wpilog`, so no new reader is needed.
- **Better names in the list:** PowerLib writes a small `session.json` into each log folder (alliance, enabled time, practice at events); renaming runs; a "New" tag; a warning when a bus's file is missing.
- **More robot download tools:** show the robot's free space, delete logs after downloading (Systemcore's log storage is small), block downloads while the robot is enabled.
- **Match Summary:** a card per match (battery low, peak currents, cycle count, auto result), comparable across an event. Cycle count could come from `ActualState` entering a scoring state.
- **Before and After Compare:** open two logs, line them up at enable, overlay the same signal. Answers "did this change help?"
- **Timeline notes:** notes at points on the timeline ("intake jammed here"), saved next to the log.
- **Auto Path Overlay:** the planned auto path next to the actual pose trail. The robot would need to log the path it's following.
- **Jump to Tuning:** from a subsystem's graph, open the Robot tab's tuning drawer for it.
- **Live Mode with Rewind:** record the 10 Hz `/PowerLib/Data` frames while connected and scrub back 30 s. Needs no robot changes.
- **Drag-and-drop layout and One Widget System:** an Elastic-style grid of widgets picked by data type, saved per robot, and the Drive tab built from the same widgets.
- **Shareable Views:** export a layout and time range as a small file for a teammate.
- **Show problem markers again** (and add vision rejects and `Robot/Control/Action` events) once there's room.
- **Standardize setpoint keys:** `Velocity`/`VelocitySetpoint`, `Position`/`SetpointRotations`, `Position`/`Setpoint` differ by subsystem type; one `<Signal>Setpoint` rule would make pairing automatic. Check every reader (`robotModel.ts`, Drive cards) before renaming.

## Open questions
- Should the templates call `SignalLogger.setPath()` so logs land in one known folder?
- Should the robot also write a WPILib `.wpilog` (`DataLogManager`) so no Owlet conversion is needed?
- Can Owlet ship inside Power Tool for laptops that never ran AdvantageScope? CTRE doesn't state redistribution terms.
- Motor assignments and picked subsystems are saved per laptop. Should they move into `power-tool/generated/` to travel with the robot project?
- Performance: parsing runs on the renderer thread, and a full match with motors uses about 400 MB. Typed arrays or a worker if real logs get slow.
- Not tested yet: a log from a PowerLib robot (real logs so far predate PowerLib).

## Decisions worth remembering
- "Current" means supply current (battery draw); stator current is its own view. The drivetrain is one "Drive" group.
- Settled means 0.5 s inside tolerance (5% of setpoint or 2% of range).
- Device signals export from a `.hoot` in full only with a Pro-licensed device in the log; PowerLib's custom signals always export.
- Keep the UI lean, and check it on the real screen before cutting detail.

Related: [2027 and Systemcore Readiness](2027%20and%20Systemcore%20Readiness.md), [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md), [Home](../README.md)
