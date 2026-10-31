---
title: Log Viewer Project
date: 2026-10-30
tags: [project, log-viewer, power-tool]
---

# Log Viewer Project

Working notes for adding a log viewer to Power Tool. Branch: `feature/Log-Viewer`. Record
decisions and open questions here as we go, and add a [CHANGELOG](CHANGELOG.md) entry for each
change that lands.

## Status
- 2026-10-30: Planning. Vault created. No log viewer code yet.

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
- **Parsing:** `.wpilog` has a documented binary format and can be parsed in TypeScript. `.hoot` is proprietary and needs CTRE's Owlet CLI to convert to `.wpilog`.
- **Charts:** there's no chart library yet. Pick one, and check it works under the CSP.
- **Live recording (optional):** a ring buffer fed from `TopicSnapshotBuffer`/`nt4Client` could record `/PowerLib/Data` frames while connected.
- **Checks:** add a `scripts/<name>-check.mjs` like the others, and list it in `tests/README.md`.

## Open questions
- [ ] Which sources: `.hoot` (via Owlet), `.wpilog`, live NT recording, or all of them?
- [ ] Pull logs from the roboRIO over SFTP/USB inside Power Tool, or open local files only?
- [ ] Do we call `SignalLogger.setPath()`/`start()` in the templates so logs land somewhere predictable?
- [ ] Should the robot also write a WPILib `DataLogManager` `.wpilog` so no conversion is needed?
- [ ] Which views: time-series plot, field replay of `Drive/Pose`, event list (`Vision/*/Status`, `Robot/Control/Action`), table?
- [ ] Chart library choice and bundle size.
- [ ] Verify the Phoenix default log location and auto-start behavior on our roboRIO.

## Decisions
_None yet._

Related: [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md), [NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md), [CHANGELOG](CHANGELOG.md)
