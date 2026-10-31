---
title: Mechanism Picker
date: 2026-10-31
tags: [idea, log-viewer]
status: decided
---

# Mechanism Picker

**Status:** Decided. Built in v1 (2026-10-31) as the default (and only) layout. Multi-select added the same day.

## Idea
Open a log and everything is already in place, with no dragging. The layout stays fixed, and the
mechanism dropdown lists every subsystem found in the log (e.g. Intake · velocity,
Shooter · velocity, Hood · position, Climber · position).

**You can pick several mechanisms at once** (e.g. shooter and hood while scoring):
- Each gets its own value-vs-setpoint graph, stacked on the same time window with one cursor. Graphs are stacked rather than overlaid because the units differ (rps vs degrees), and one axis would flatten the smaller one.
- The mechanism status table has one row per pick: at setpoint, value, setpoint, error, overshoot and settle time (see [Setpoint Error Widget](Setpoint%20Error%20Widget.md)).
- The picks are remembered, so the next log opens on the same mechanisms. A log with none of them opens on the busiest one.

The field, battery, state strip and timeline don't change. Clicking a
[problem marker](Problem%20Markers.md) adds the mechanism involved to the selection.

## Why
- The user wants to open a log and have it look the way they want, without building a layout each time.
- The dropdown is filled from the log, so a new season's mechanisms show up with no code or layout changes.

## Open questions
- Does this replace drag-and-drop in [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md), or sit alongside it as the default layout?
- The selection is remembered per laptop, not per robot project. Should it move into `power-tool/generated/` so it travels with the robot?
- Overlay option: should two mechanisms with the same units (e.g. two flywheels) be drawable on one graph?

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md)
