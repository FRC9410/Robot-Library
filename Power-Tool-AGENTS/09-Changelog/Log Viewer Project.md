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
- 2026-10-30: Picked the UI direction: an Elastic-style widget grid with a shared timeline (see Decisions).
- 2026-10-30: Decided the viewer reads both `.wpilog` and `.hoot` (see Decisions). Which one the robot writes is decided later, in robot code.

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
- [x] Which sources: both `.wpilog` and `.hoot` (see Decisions). Live NT recording is still a possible later addition.
- [ ] Owlet: can we ship it inside Power Tool, or does each laptop download it? CTRE's CLI tools page doesn't state redistribution terms or how Owlet versions match `.hoot` versions.
- [ ] A session makes one `.hoot` per CAN bus. Should the viewer open the whole session folder and merge them?
- [ ] Pull logs from the roboRIO over SFTP/USB inside Power Tool, or open local files only?
- [ ] Do we call `SignalLogger.setPath()`/`start()` in the templates so logs land somewhere predictable?
- [ ] Should the robot also write a WPILib `DataLogManager` `.wpilog` so no conversion is needed?
- [x] Which views: answered by the widget-grid decision below. Still open: whether to add an event list (`Vision/*/Status`, `Robot/Control/Action`) as markers on the timeline.
- [ ] Chart library choice and bundle size. Leaning uPlot for graphs and react-grid-layout for the grid. Not installed yet; check both under the CSP.
- [ ] Setpoint key names differ by subsystem type: `VelocitySetpoint` (`VelocitySubsystem.java`), `SetpointRotations` (`AbsolutePositionSubsystem.java`), `Setpoint` (`RelativePositionSubsystem.java`). Standardize to `<Signal>Setpoint`, or keep a lookup table in the viewer? Renaming changes log keys and may affect `robotModel.ts`; check readers first.
- [ ] Verify the Phoenix default log location and auto-start behavior on our roboRIO. CTRE's docs say it auto-starts when enabled on a roboRIO 2 (see [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)).

## Decisions

### 2026-10-30: Widget grid with a shared timeline, chosen by data shape
The viewer looks like Elastic: topics are dragged from a tree onto a grid and become widgets.
One timeline at the bottom drives every widget. Scrubbing or playing replays the whole grid,
and the timeline shows auto/teleop/disabled bands from `Drive/Mode`.

The tool must work every season without code changes, so **it never decides by game**. It
picks widgets with three rules, in order:

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

The only per-season input is the field image and size, which is a setting
(`drive-template.json`), not code. Widgets read from a data-source interface so live NT and
log files share the same widget code.

### 2026-10-30: Read both `.wpilog` and `.hoot`
The viewer opens either format, so the robot-side choice (SignalLogger `.hoot`, WPILib
`DataLogManager` `.wpilog`, or both) can be made later in robot code.

- **One parser:** a TypeScript `.wpilog` reader in the renderer. All widgets read through it.
- **`.hoot` is a conversion step:** the Electron main process runs Owlet
  (`owlet -f wpilog in.hoot out.wpilog`) into a temp file, then hands the result to the
  `.wpilog` reader. `.hoot` support is just "find Owlet, run it, open the output".
- If Owlet isn't found, the viewer still opens `.wpilog` files and explains how to get Owlet.

Related: [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md), [NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md), [CHANGELOG](CHANGELOG.md)
