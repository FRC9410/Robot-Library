---
title: Tabs and Features
date: 2026-10-30
tags: [power-tool, ui]
---

# Tabs and Features

Every tab lives in `powerlib-dashboard/src/features/<feature>/`. `App.tsx` renders the active one.

## Drive (`features/drive/`)
The competition view. The Drive tab renders `power-tool/dashboard/index.tsx`, which by default
re-exports `DrivePanel` (see [Custom Dashboard](Custom%20Dashboard.md)).
- `DrivePanel.tsx` has these parts:
  - Top: match time, mode, battery, requested/actual state.
  - Left rail: field thumbnail and camera thumbnails.
  - Center: SVG field or the selected camera.
  - Sidebar: auto chooser.
  - Bottom: drivetrain and mechanism cards.
  - Status bar: alliance and CAN %.
- `driveModel.ts`: pure functions that turn topics into drive state.
  - **Live** means a heartbeat was received in the last 1.2 s.
  - Pose sources, in order: scalars, then `/SmartDashboard/Field/Robot`, then `struct:Pose2d`.
  - Mechanism cards come from `/PowerLib/Subsystems/<X>/Data/(Velocity|Position)`.
  - Auto selection is allowed only while live and disabled.
- `drive-template.json`: field size (16.54 × 8.07 m) and topic aliases (new path first, then legacy `/PowerLib/Drive/...`).
  - The field size only affects **drawing**. Each viewer can change it in Crew tools; it's saved in that machine's localStorage.
  - It does **not** match the robot's vision bounds in `LocationConstants` (17.548 × 8.052 m). See "Field dimensions" in [Units and Coordinates](../10-Guides/Units%20and%20Coordinates.md).
- `cameraStream.ts`: MJPEG `<img>` with ordered URL failover, a 4 s first-frame timeout and retry.
- **Crew tools → "Export telemetry snapshot"** downloads a one-off `powerlib-drive-snapshot.json`. It isn't a recording; for recordings use the [Logs](#logs-featureslogs) tab.
- Setup and topic table: `powerlib-dashboard/DRIVE-DASHBOARD.md`.

## Robot (`features/robot/`)
Live cards per subsystem plus constants and tuning, all in one place.
- `RobotPanel.tsx` + `robotModel.ts` (`createRobotCards`) build the cards by merging:
  - configured subsystems;
  - `/PowerLib/Subsystems/<Owner>/Data/*` live data;
  - constants files from `window.powerlib.readConstants()`;
  - tunables from `/PowerLib/(Subsystems|Commands)/<Owner>/Variables/*`.
- `RobotTuningDrawer.tsx`: click a card to see its tunables.
  - **Apply** publishes live edits over NT, or saves saved-only edits through `saveConstants`.
  - Reset clears one field's pending edit.
  - Opens **Save Tuned Values**.
- Details: [Tuning Round Trip](../06-Data-Flows/Tuning%20Round%20Trip.md).

## Subsystems (`features/subsystems/`)
A form editor for `power-tool/generated/powerlib-subsystems.json`.
- Sidebar list + `SubsystemEditor`. Field groups: basic, motors, CANcoder, relative position, PID/FF/Motion Magic.
- Types: `velocity`, `velocityTorque`, `absolutePosition`, `relativePosition`.
- Save writes JSON only. **File → Update Code** runs the generator. See [Code Generation Flow](../06-Data-Flows/Code%20Generation%20Flow.md).
- `CharacterizationDialog` (velocity types only) lists robot commands under `/PowerLib/Characterization/<Name>/…/.type == "PowerLibCommand"` and starts one by publishing `<base>/request = true`. It shows no results.

## Logs (`features/logs/`)
Replays a robot log file. Works offline; it doesn't use NetworkTables.
- **Opening:** click a log in the **logs list**, use "Open another file" under it (`window.powerlib.openLog`), or drag files onto the tab.
  - **Logs list** (`LogLibrary`, built 2026-11-03; idea: [Built-in Log List](../11-Ideas/Built-in%20Log%20List.md)): every `.hoot`/`.wpilog` up to 4 folders deep in the logs folder (a setting on this laptop, saved as `powerlib.logs.folder.v1`; default `Documents\Power Tool\Logs`; IPC `powerlib:list-logs`, `powerlib:choose-logs-folder`, `powerlib:default-logs-folder`). With no log open, the start page's centered **Open log** button (`OpenLogPrompt`) opens it as a popup in the middle (`LogsDialog`). With a log open, the status bar's **Logs** button opens it in a drawer from the right (`LogsDrawer`, above the app bar). Both use the same flat frame (`logsSurface` in `logUtils.ts`; MUI's dark-mode lightening of raised surfaces is turned off so they match the tab's cards).
    - `logLibraryModel.ts`: `groupLogFiles` makes one `SavedLog` per run (same folder and time stamp; roboRIO file first). `parseLogFileName` reads Phoenix names (`[<EVENT>_<Q12>_]<bus>_YYYY-MM-DD_HH-MM-SS.hoot`, local time) and DataLogManager names (`FRC_YYYYMMDD_HHMMSS[_<EVENT>_<Q12>].wpilog`, UTC). Matches are named "Qual 6" / "Elim 3", other runs "Fri 2:15 PM".
    - `groupSavedLogs(logs, filter, search)`: Matches (the default filter), Practice or All. Matches group by event, titled by a folder named for the event ("2026 KSLA - Heartland") or else the event code; other runs group by week. Search also matches folder names.
    - Pieces: `LogLibraryToolbar` (two rows so it fits the 520 px drawer: title, refresh and close; then filter chips and search), `SavedLogGroup` (folding header), `SavedLogRow` (name, Open/Loaded, `savedLogWhen`, `formatBytes` of the run's files), `LogFolderBar` (folder, Change, Open another file). `useLogLibrary` lists the folder.
  - **Get logs from robot** (`RobotLogsButton`, built 2026-11-03; idea: [Pull Logs from the Robot](../11-Ideas/Pull%20Logs%20from%20the%20Robot.md)): next to Open log on the start page and in the logs list's top row. Greyed out until the robot answers on SSH; `useRobotReachable` asks `powerlib:find-robot` every 4 s, which tries `10.94.10.2`, `roborio-9410-frc.local`, `robot.local` and `172.22.11.2` (USB) on port 22 at once.
    - `electron/robotLogs.ts` (`ssh2`): logs in with the default logins (roboRIO `lvuser` / `admin` with no password, then Systemcore `systemcore`/`systemcore`), lists `.hoot`/`.wpilog` in `/U/logs`, `/u/logs`, `/media/sda1/logs`, `/home/lvuser/logs` and `/home/systemcore/logs` (one subfolder level deep), and downloads with `fastGet` into a `.part` file, skipping files already there at the same size. Progress comes back on `powerlib:robot-download-progress`.
    - `RobotLogsDialog` (same frame as the logs popup): the robot's runs grouped like the logs list (`SavedLogGroup` takes a `renderLog` slot), each a `RobotLogRow` with a checkbox, "Downloaded"/"On robot" (`isDownloaded`, by file name), when and size. `RobotLogsFooter`: one ticked → **Download and open**, several → **Download N** (nothing opens).
    - Downloads land where the list expects them (`downloadFolderFor`): a match in its event's folder, reusing one already there ("2026 KSLA - Heartland/Qual 70 (2026-03-21_17-02)"), else `<year> <EVENT>/…`; other runs in `Shop/2026-11-04 18-30`.
    - **Testing without a robot:** `scripts/fake-robot.mjs` is an SFTP server (also `ssh2`) on 127.0.0.1:2222 that serves a folder read-only as `/U/logs` with the `lvuser` login. Setting `POWERLIB_ROBOT=host[:port]` makes Power Tool try only that address. `npm run check:robot-logs` uses both.
    - Not yet: deleting logs from the robot, showing its free space, and blocking downloads while the robot is enabled.
  - **Open logs live above the tab:** `LoadedLogsProvider` (in `main.tsx`) holds `useLogFile`'s state in context (`useLoadedLogs`), so the open log doesn't depend on `LogsPanel` staying mounted. The last 3 logs opened from the list stay parsed in memory ("Loaded" in the list) and reopen instantly. `App.tsx` still keeps `LogsPanel` mounted so the playback position survives tab switches.
  - A `.hoot` opens its whole session (every CAN bus's file from that match) through Owlet. See [Power Tool Architecture](Power%20Tool%20Architecture.md). The list opens a run's files with `powerlib:open-log-files`.
  - Dropped `.wpilog` files are read in the renderer; dropping several opens them together as one session.
- `wpilog.ts`: `.wpilog` v1.0 reader. `parseWpilog(bytes, keep)` skips signals `keep` rejects (the tab passes `isViewerSignal`).
  - Decodes boolean, int64, float, double, string/json, the array types and `struct:Pose2d`. Schemas and raw types are skipped.
  - An entry finished and restarted under a new ID stays one signal.
  - A cut-off last record sets `truncated`, and the tab shows a warning instead of failing.
- `logModel.ts` (`buildLogModel(sources, subsystems, assignments)`) turns signals into what the tab shows:
  - **Sources:** one per file. `busName` labels each by file name: `rio`, `CANivore` (hex ID in the name), else the file name. Custom signals repeated in several files are read from the first (roboRIO) one.
  - **Motors:** every `Phoenix6/TalonFX-<id>/<signal>` becomes a `LogMotor` keyed `<bus>:<id>`, since IDs can repeat across buses.
    - Motors are grouped automatically when a log opens. Each motor's `source` records which rule won, strongest first:
      1. `override`: the Assign motors dialog (`assignments`): a mechanism, a new group like `Drive` (a `motors`-kind entry whose value is power), or `""` for unassigned;
      2. `config`: the `motors[].id` CAN IDs in `powerlib-subsystems.json`;
      3. `tuner`: swerve IDs from the robot's `TunerConstants.java` (`k<Module>Drive|SteerMotorId`, read by the `powerlib:read-drive-motor-ids` IPC) → `Drive`;
      4. `motion` (`matchByMotion`): over enabled periods (≤3,000 samples), the |correlation| between each mechanism's value and the motor's `Position` (position mechanisms) or its change in position (velocity mechanisms). Each motor goes to its best match if ≥ 0.9 (`matchScore`). Correlation ignores gear ratios, units, offsets and inverted followers;
      5. `guess`: if no TunerConstants IDs were found and IDs 1–8 are all still unassigned on one bus (the template's swerve IDs) → `Drive`, labeled as a guess.

      For rules 2–3, when an ID is on both buses the CANivore one wins, because PowerLib mechanisms and the swerve default to the `canivore` bus.
    - Each unassigned motor is also listed on its own (`motor:<key>`).
    - `combineMotors` gives each mechanism/group `metrics`: summed `current` (supply) and `stator`, `power` (Σ supply voltage × supply current; battery voltage if `SupplyVoltage` is missing), mean applied `voltage`, and max `temp`.
    - `powerGroups` lists power per group plus one "Unassigned motors" entry.
  - **Signal names:** `metricKey` matches `…/Subsystems/<owner>/Data/<key>` anywhere in a name, so SignalLogger (`PowerLib/…`), DataLogManager (`NT:/PowerLib/…`) and Owlet exports all work. Also legacy `/PowerLib/Drive/<key>`, `…/RobotStatus/<key>` and `DS:enabled|autonomous|test`.
  - **`/PowerLib/Data` JSON frames** are expanded per key, but only fill keys that have no per-key signal (`usedFrames`).
  - **Fallbacks for logs without PowerLib keys:**
    - Owlet's built-in `Voltage`, `CAN Utilization` (%), `RobotMode` (`Disabled`/`Autonomous`/`Teleop`/`Test`) and `RobotEnable` stand in for `Drive/BatteryVolts`, `RioCanUtilization`, `Mode` and `Enabled`.
    - `plainMechanismKey` reads plain names like `Shooter Velocity`, `Intake Wrist Position` and `Shooter Velocity Setpoint` as mechanisms, so pre-PowerLib logs still graph.
  - **Times** are seconds from the first sample.
  - **Mechanisms:** any owner except Drive/Swerve with `Velocity` or `Position`. Setpoint is `VelocitySetpoint`/`Setpoint` or `PositionSetpoint`/`SetpointRotations`/`Setpoint`; on-target is `AtTarget`/`AtSetpoint`. Units come from the signal's JSON metadata (`units`), else `powerlib-subsystems.json`, else `rps`/`rot`.
  - **Periods** (match list) come from `Drive/Mode`, else `Drive/Enabled` or `DS:*`.
  - **Problem markers:**
    - `RobotStatus/BrownedOut` (else battery under 7 V);
    - CAN over 90%;
    - setpoint misses: off by more than `toleranceFor` (5% of setpoint or 2% of range) for 0.5 s, at least 1 s after the setpoint changed, while enabled.
  - `stepStats`: overshoot and settle time (0.5 s inside tolerance) for the step in effect.
  - `busiestMechanism`: the mechanism the tab opens on. Prefers the one with the most setpoint changes; with no setpoints, the one whose value moved most often. Motor-only groups come last.
- `LogsPanel.tsx` puts the pieces in `components/` together (one component per file, see [React Code Rules](React%20Code%20Rules.md)). Hooks: `useLogFile` (open/drop/convert; used only by `LoadedLogsProvider`, read through `useLoadedLogs`), `useLogLibrary` (logs folder), `useLogPlayback` (clock, speed, keys). Helpers: `logUtils.ts` (colors, `groupColor`, `pickedGroups`, formatting, `seriesPath`, saved choices). Each widget stands on its own (data in through props, sizes to the space it's given), so layouts can be rearranged in `LogsPanel` alone.
  - **The tab fits the window and never scrolls the page** (`App.tsx` gives the Robot and Logs tabs a fixed height). Widgets that run long scroll on their own inside `ScrollArea` (thin dark scrollbar). Checked at 1280x720 and 1920x1080.
  - **Layout** (`LogsLayout`, only arranges the widgets it's given): three columns: graphs; the field standing up with the driver station side at the bottom (`orientation="vertical"`); the Power card at a fixed 400 px (its current graph is 180 px). The team chose this layout on 2026-11-02; the 2-column layout and its switch were removed.
  - Left: `SubsystemGraphs`, full height. The **Subsystems** dropdown (`SubsystemPicker`) picks subsystems; each gets a `SubsystemPlot`, stacked on the same 20 s window with one cursor, so different units never share an axis.
    - Each graph is a tile (`SubsystemPlot` = `SubsystemPlotHeader` + `GraphViewSelector` + `PlotChart`). Tiles go two across when the graphs card is at least 500 px wide (container query) and scroll when they don't fit. Every chart is a fixed height: 90 px, or 170 px when the window is at least 1000 px tall. Checked at 1280x720 and 1920x1080 (the mentor's targets).
    - Tiles are outlined cards with a stripe down the left edge in the subsystem's Power card color (`colorOf`); `colorLines` (off) draws the line in that color too.
    - `PlotChart` is generic: a line shaded underneath (`areaPath` in `logUtils.ts`), an optional dashed setpoint, faint dashed grid, the axis ends and −10 s / now / +10 s under it. The header shows the value now in large type, the setpoint after an arrow (or "no setpoint"), and the hottest motor's temperature.
    - Current, Voltage and Stator: with two or more motors, each motor is a thin colored line (hover for its name) and the bold line is their **average** (`motorAverage` in `logModel.ts`, `motorSignalFor` maps the view to SupplyCurrent / MotorVoltage / StatorCurrent); the header reads e.g. "11.3 A avg". Its axis spans each motor's 0.1 s means plus zero, so real peaks fit but single-sample noise doesn't stretch it; motor lines are smoothed over 0.1 s and faint so the average reads on top. A key under the graph (`LineKey`) lists Avg and each motor by CAN ID (`#21`) in the line colors (`motorLineColor`); clicking an entry makes that line bold and shaded, fades the rest, and the header shows its value (e.g. "11.3 A #21"). The choice is per tile and not saved. Charts shade between the line and zero. With one motor it's just that motor. The Power card still sums current per subsystem.
    - Graphs draw at most ~900 points per line. When a window has more samples, `seriesPath` keeps every Nth sample of the whole log (N fixed by window length), so the same samples stay drawn while the window slides. Choosing them relative to the window made lines shimmer during playback.
    - The setpoint is a purple dashed line. If the log has no setpoint for that subsystem, the legend says "Setpoint not logged".
    - The selection is saved in localStorage (`powerlib.logs.mechanisms.v1`), and the next log opens with the same subsystems if it has them; otherwise `busiestMechanism`.
    - Above each graph, `GraphViewSelector` is a segmented row: Position/Velocity (vs setpoint), Current, Voltage, Stator (only the readings it has). Power has its own widget; the hottest motor's temperature is a number next to the subsystem name (red at 70 °C). Saved per subsystem in `powerlib.logs.graphViews.v1`.
    - **Motor readings are noisy** (logged at ~100 Hz, jumping between samples), so motor views draw each fixed group of samples as its mean (at least 0.05 s per point, `seriesPath`'s `averageSeconds`). Their readouts use `averageAt` (mean of the last 0.5 s). Value views stay raw.
  - `FieldView` (uses the Drive tab's field size and flip) has a **Position | Heat map** toggle. It's built from `FieldCanvas` (outline, zones, orientation, flip; layers as children in field coordinates), `RobotPose` (robot plus 3 s trail) and `FieldHeatmap` (cells from `poseHeatmap` in `logModel.ts`: enabled pose samples per 0.3 m cell, square-root shaded). The position readout is under the field. It shares the column's height with the Power card and never goes below 210 px.
  - Right, bottom: `PowerCard`, one card for the subsystems picked in the Subsystems dropdown (power groups plus any picked single motors, `pickedGroups` in `logUtils.ts`):
    - Header: the whole robot's supply current and the battery voltage (0.5 s averages), and **Assign motors**.
    - `CurrentGraph`: their supply current stacked in **amps** over the graphs' window. It stacks `slotMeans` (0.1 s slots at fixed positions in the log) and uses one rounded y-scale from the busiest 0.1 s over the whole log, so it doesn't shimmer or rescale while it plays.
    - A divider, then `PowerTable`: Subsystem, Current, Temp (hottest motor, red at 70 °C), one `PowerTableRow` each. Only one subsystem's motors (`PowerMotorRow`: current and temp) can be open at a time, so the table stays short; it scrolls inside the card if it must.
    - Each group's color (`groupColor`) comes from its place in the full `powerGroups` list, so it doesn't change with the selection; the graph and the table use the same colors.
    - **Assign motors** opens `MotorAssignDialog`, which lists every motor with bus, peak current and how it was grouped (e.g. "Shooter · matched by motion 0.99"), for fixing mistakes. Choices are saved in `powerlib.logs.motorGroups.v1`; "Automatic" goes back to the automatic grouping.
    - No setpoint table: the setpoint is in the graphs, and overshoot/settle time were dropped on the mentor's advice.
  - Bottom: `PlayBar` on one row: play/pause (Space), 0.5-4x speed, the time with its match period, the **match clock** ("1:45 left", from `Drive/MatchTimeSeconds` via `matchClockAt`; hidden when the log has none or it reads negative), an **FMS** tag while `RobotStatus/FmsAttached` (or Owlet's `DS:IsFMSAttached`) is true, the robot's current state (`Drive/ActualState`), the `Timeline` (periods on top, state underneath; click or drag to seek; arrows step 1 s, Shift 5 s) and `PhaseToggle`, a segmented Auto | Teleop switch that highlights the period being played and jumps to a period's start.
  - Very bottom: `LogStatusBar`, edge to edge: Logs (opens the logs drawer), the log's name ("Qual 6 · KSLA" when opened from the list), "Converted from .hoot", length, buses, signal and motor counts, and CAN % at the current time (`canPercentAt`).
  - Problem markers are still found (`findMarkers`) but not shown for now.
- The panel stays mounted (hidden) when you switch tabs, so the open log is kept. Playback pauses while hidden.
- Ideas and plans: [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md).

## Limelights (`features/limelights/`)
Only shown when a Limelight table is detected (`limelightUtils.detectLimelights`). One sub-tab per
camera embeds its web UI (`http://<name>.local:5801`), with a per-camera URL override.

## NetworkTables (`features/networktables/`)
- `NetworkTablesPanel.tsx`: read-only tree of every topic, with type, value and a filter. It subscribes to `/` only while open.
- `ConnectionSettingsDialog.tsx`: host and port presets.
- `SaveTunedValuesDialog.tsx`: diffs live tunables against saved JSON and writes the ones you select.
- `tuningUtils.ts`: tuning topic names and draft parsing.

## Constants (`features/constants/types.ts`)
Types and Java literal formatting only. Constants are edited in the Robot tab drawer.

## Adding a tab
1. Add the value to `AppView` in `src/types/app.ts`.
2. Add a `<Tab>` and a panel branch in `App.tsx`.
3. Put the code in `src/features/<name>/`, laid out as in [React Code Rules](React%20Code%20Rules.md).
4. If it needs disk access, add an IPC handler in `electron/main.ts`, expose it in `preload.cts`, and type it in `src/types/electron.d.ts`.

Related: [Power Tool Architecture](Power%20Tool%20Architecture.md), [NetworkTables Layer](NetworkTables%20Layer.md), [Custom Dashboard](Custom%20Dashboard.md), [React Code Rules](React%20Code%20Rules.md), [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md)
