---
title: Log Viewer Project
date: 2026-10-30
tags: [project, log-viewer, power-tool]
---

# Log Viewer Project

The hub for adding a log viewer to Power Tool. Branch: `feature/Log-Viewer`. Each idea we talk
about gets its own note in this folder (listed in [Ideas](INDEX.md)). This note keeps the status,
the starting point and the project-wide open questions. Code changes go in the
[CHANGELOG](../09-Changelog/CHANGELOG.md) once they land.

## Status
- 2026-10-30: Planning. No log viewer code yet. Still collecting ideas before building.

## Decided
- [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md)
- [Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md)
- [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md)

Proposed ideas are listed in [Ideas](INDEX.md).

## What exists today (starting point)
- **Robot side** ([Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)):
  - Every shared-map metric is logged at 50 Hz to CTRE **SignalLogger** as `PowerLib/Subsystems/<owner>/Data/<key>`, typed, with units.
  - Log-only keys: `PowerLib/RobotStatus/*` and `Vision/*`.
  - Files are `.hoot` on the roboRIO. Nothing calls `SignalLogger.start()`/`setPath()`, so Phoenix defaults apply.
- **Live NT:** `/PowerLib/Data` JSON at 10 Hz, plus the `Pose2d` struct topic.
- **Power Tool** ([Power Tool Architecture](../05-Power-Tool/Power%20Tool%20Architecture.md)):
  - No log, file-picker, chart or history code at all.
  - Keeps only the latest value per topic.
  - The only export is the Drive tab's one-shot JSON snapshot.
  - IPC has no file dialog or arbitrary file read.
  - The CSP is strict (`script-src 'self'`).

## Where a viewer would plug in
- **New tab:**
  - add `"logs"` to `AppView` in `src/types/app.ts`;
  - add a tab and panel branch in `App.tsx`;
  - put the code in `src/features/logs/`.
  See "Adding a tab" in [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md).
- **File access:** a new `ipcMain.handle` in `electron/main.ts` (`dialog.showOpenDialog` + read), exposed in `preload.cts` and typed in `src/types/electron.d.ts`.
- **Parsing:** see [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md).
- **Charts:** there's no chart library yet. Leaning uPlot for graphs and react-grid-layout for the grid. Neither is installed; check both under the CSP.
- **Checks:** add a `scripts/<name>-check.mjs` like the others, and list it in `tests/README.md`.

## Open questions (project-wide)
Questions about a single idea live in that idea's note.
- [ ] Should the templates call `SignalLogger.setPath()`/`start()` so logs land somewhere predictable?
- [ ] Should the robot also write a WPILib `DataLogManager` `.wpilog` so no conversion is needed?
- [ ] Chart and grid library choice, and bundle size.
- [ ] Verify the Phoenix default log location and auto-start behavior on our roboRIO. CTRE's docs say it auto-starts when enabled on a roboRIO 2 (see [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)).

Related: [Ideas](INDEX.md), [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md), [NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md)
