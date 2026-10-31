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

**Decided**
- [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md): Elastic-style grid, one timeline drives every widget.
- [Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md): type → widget, PowerLib conventions, saved per robot; never game-specific.
- [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md): one `.wpilog` reader, `.hoot` converted through Owlet.

**Proposed**
- [Standardize Setpoint Keys](Standardize%20Setpoint%20Keys.md): one `<Signal>Setpoint` naming rule across subsystem types.
- [Match List](Match%20List.md): split a log into enable periods you can click.
- [Problem Markers](Problem%20Markers.md): brownouts, CAN spikes, setpoint misses and vision rejects on the timeline.
- [Auto Path Overlay](Auto%20Path%20Overlay.md): planned path next to the actual pose trail.
- [Setpoint Error Widget](Setpoint%20Error%20Widget.md): error graph with overshoot and settle time.
- [Before and After Compare](Before%20and%20After%20Compare.md): overlay the same signal from two logs.
- [Jump to Tuning](Jump%20to%20Tuning.md): open the tuning drawer from a graph.
- [Pull Logs from the Robot](Pull%20Logs%20from%20the%20Robot.md): one button to copy logs off the roboRIO.
- [Timeline Notes and Bookmarks](Timeline%20Notes%20and%20Bookmarks.md): notes saved next to the log.
- [Shareable Views](Shareable%20Views.md): export a layout plus time range.
- [Live Mode with Rewind](Live%20Mode%20with%20Rewind.md): record NT while connected and scrub back.
- [One Widget System Everywhere](One%20Widget%20System%20Everywhere.md): the Drive tab built from the same widgets.
- [Match Summary](Match%20Summary.md): a card per match, comparable across an event.

Up: [Home](../README.md)
