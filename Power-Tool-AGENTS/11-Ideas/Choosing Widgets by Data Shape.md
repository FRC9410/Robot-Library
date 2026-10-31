---
title: Choosing Widgets by Data Shape
date: 2026-10-30
tags: [idea, log-viewer]
status: decided
---

# Choosing Widgets by Data Shape

**Status:** Decided, 2026-10-30.

## Idea
The tool is used every season, so **it never decides what to show based on the game**. It picks
widgets with three rules, in order:

1. **Data type picks the widget:**
   - `Pose2d` struct → field view with a trail;
   - boolean → colored box;
   - string → state strip (colored segments per value);
   - number → graph, or a big number if it barely changes;
   - anything else → text.
2. **PowerLib conventions group and overlay:**
   - The subsystem type in `powerlib-subsystems.json` (velocity / position) gives a value + setpoint overlay graph.
   - Signals with the same units can share an axis (units come from the log).
   - One card group per subsystem, like the Robot tab.
3. **The user has the final say:**
   - The auto layout is only a starting point ("Generate layout").
   - Right-click a widget to change how it's shown.
   - Layouts are saved per robot under `power-tool/generated/`. A new robot project starts with a fresh auto layout.

The only per-season input is the field image and size, which is a setting (`drive-template.json`), not code.

## Why
A 2027 elevator and a 2026 intake are both just numbers with setpoints. Rules based on data
shape keep working when the mechanisms change.

## Notes
- Rule 2's setpoint pairing depends on consistent key names. See [Standardize Setpoint Keys](Standardize%20Setpoint%20Keys.md).

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
