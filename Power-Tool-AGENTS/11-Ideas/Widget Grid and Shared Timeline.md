---
title: Widget Grid and Shared Timeline
date: 2026-10-30
tags: [idea, log-viewer]
status: decided
---

# Widget Grid and Shared Timeline

**Status:** Decided, 2026-10-30.

## Idea
The log viewer looks like Elastic:
- Drag topics from a tree on the left onto a grid, where they become widgets. Widgets can be moved and resized.
- One timeline at the bottom drives every widget. Scrubbing or playing replays the whole grid at once.
- The timeline shows auto, teleop and disabled bands from `Drive/Mode`, plus play/pause and speed controls.

## Why
- Elastic is already familiar to the team.
- One shared timeline makes it easy to compare signals at the same moment, e.g. what the intake was doing when the state changed.

## Notes
- Leaning toward react-grid-layout for the grid and uPlot for graphs. Neither is installed yet; check both under Power Tool's CSP.
- Widgets read from a data-source interface, so live NT and log files can share the same widget code. See [Live Mode with Rewind](Live%20Mode%20with%20Rewind.md) and [One Widget System Everywhere](One%20Widget%20System%20Everywhere.md).

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md)
