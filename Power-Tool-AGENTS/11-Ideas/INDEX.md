---
title: Ideas
date: 2026-10-30
tags: [index, idea]
---

# Ideas

Projects in planning and the ideas we've talked about, **one note per idea**. Each note's
frontmatter has a `status`: `proposed` (talked about, not chosen), `decided` (we're doing it), or
`dropped` (keep the note and say why). When an idea is built, its code change goes in the
[CHANGELOG](../09-Changelog/CHANGELOG.md).

## Log viewer
[Log Viewer Project](Log%20Viewer%20Project.md): status, open questions and where it plugs into Power Tool.

**Decided** (built in v1, 2026-10-31, unless marked partly)
- [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md): one `.wpilog` reader, `.hoot` converted through Owlet.
- [Mechanism Power and Current](Mechanism%20Power%20and%20Current.md): current, power, applied voltage and temperature per mechanism from Phoenix's motor signals, with a power widget and motor assignment.
- [Mechanism Picker](Mechanism%20Picker.md): fixed layout; a multi-select dropdown stacks a graph and a status row for each picked mechanism.
- [Match List](Match%20List.md): split a log into enable periods you can click.
- [Setpoint Error Widget](Setpoint%20Error%20Widget.md): error, overshoot and settle time.
- [Problem Markers](Problem%20Markers.md) (partly): brownouts, CAN spikes and setpoint misses; vision rejects not yet.
- [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md) (partly): shared timeline built; drag-and-drop grid not yet.
- [Pull Logs from the Robot](Pull%20Logs%20from%20the%20Robot.md) (partly, 2026-11-03; not yet tried on a robot): Get logs from robot downloads runs over SFTP into the logs folder.
- [Built-in Log List](Built-in%20Log%20List.md) (partly, 2026-11-03): the start page and a drawer list the logs folder by event; click a run to open it.
- [Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md) (partly): PowerLib conventions built; type → widget and saved layouts not yet.

**Proposed**
- [Standardize Setpoint Keys](Standardize%20Setpoint%20Keys.md): one `<Signal>Setpoint` naming rule across subsystem types.
- [Auto Path Overlay](Auto%20Path%20Overlay.md): planned path next to the actual pose trail.
- [Before and After Compare](Before%20and%20After%20Compare.md): overlay the same signal from two logs.
- [Jump to Tuning](Jump%20to%20Tuning.md): open the tuning drawer from a graph.
- [Timeline Notes and Bookmarks](Timeline%20Notes%20and%20Bookmarks.md): notes saved next to the log.
- [Shareable Views](Shareable%20Views.md): export a layout plus time range.
- [Live Mode with Rewind](Live%20Mode%20with%20Rewind.md): record NT while connected and scrub back.
- [One Widget System Everywhere](One%20Widget%20System%20Everywhere.md): the Drive tab built from the same widgets.
- [Match Summary](Match%20Summary.md): a card per match, comparable across an event.
- [Vertical Field Layout](Vertical%20Field%20Layout.md): field standing up on the right, power graph and table in one card on the left.

## Next season
- [2027 and Systemcore Readiness](2027%20and%20Systemcore%20Readiness.md) (proposed): what has to change in PowerLib and Power Tool for WPILib 2027, Phoenix 2027 and Systemcore.

Up: [Home](../README.md)
