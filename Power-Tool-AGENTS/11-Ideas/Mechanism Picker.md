---
title: Mechanism Picker
date: 2026-10-31
tags: [idea, log-viewer]
status: decided
---

# Mechanism Picker

**Status:** Decided. Built in v1 (2026-10-31) as the default (and only) layout. A log opens on the mechanism with the most setpoint changes.

## Idea
Open a log and everything is already in place, with no dragging. The layout stays fixed, and the
mechanism graph has a dropdown listing every subsystem found in the log (e.g. Intake · velocity,
Shooter · velocity, Hood · position, Climber · position).

Picking one switches every mechanism widget together:
- the value vs setpoint graph (Y axis and units rescale to that mechanism);
- the AtSetpoint box;
- the [Setpoint Error Widget](Setpoint%20Error%20Widget.md).

The field, battery, state strip and timeline don't change. Clicking a
[problem marker](Problem%20Markers.md) also switches the dropdown to the mechanism involved.

## Why
- The user wants to open a log and have it look the way they want, without building a layout each time.
- The dropdown is filled from the log, so a new season's mechanisms show up with no code or layout changes.

## Open questions
- Does this replace drag-and-drop in [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md), or sit alongside it as the default layout?
- Should there be two graphs with their own dropdowns, so two mechanisms can be compared side by side (e.g. shooter and hood while scoring)?
- Remember the last mechanism picked per robot?

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md)
