---
title: Changelog
date: 2026-10-30
tags: [changelog]
---

# Changelog

Newest first. **Code changes only:** add an entry for every change to Robot-Library's code
(library, templates, scripts, Power Tool): what changed, why, the files touched, and the notes in
this vault that were updated. Edits that only touch vault notes don't get an entry, and ideas
and decisions go in [11 Ideas](../11-Ideas/INDEX.md). Older history (before this vault existed)
is summarized from `git log` and grouped by period.

Entry format:

```markdown
## YYYY-MM-DD: short title
- **What:** one or two lines
- **Why:** the problem it solves
- **Files:** `path/one`, `path/two`
- **Notes updated:** links to vault notes changed to match
- **Branch / commit:** feature/x, abc1234
```

---

## 2026-11-03: Get logs from robot
- **What:** A **Get logs from robot** button (start page and logs list) is greyed out until the robot answers on SSH, then opens a popup listing the robot's runs with checkboxes, "Downloaded"/"On robot", time and size. One ticked downloads and opens it; several just download. Files land in the logs folder in the same event/Shop layout the list reads. New `electron/robotLogs.ts` (SFTP through the new `ssh2` dependency; roboRIO and Systemcore default logins and log folders), IPC `powerlib:find-robot`, `list-robot-logs`, `download-robot-logs` and the `robot-download-progress` event. `SavedLogGroup` now takes a `renderLog` slot; `groupLogFiles` normalizes `\` to `/` in folders; new `isDownloaded` and `downloadFolderFor` (checked in `log-check.mjs`).
- **Why:** Pulling logs meant a USB stick or Phoenix Tuner. On Systemcore's small internal storage, pulling after each match also keeps it from filling.
- **Files:** `powerlib-dashboard/package.json` (`ssh2`, `@types/ssh2`, `check:robot-logs`, `fake-robot`), `scripts/fake-robot.mjs`, `scripts/robot-logs-check.mjs`, `electron/robotLogs.ts`, `electron/main.ts`, `electron/preload.cts`, `src/types/electron.d.ts`, `src/features/logs/logLibraryModel.ts`, new `useRobotReachable.ts`, `useRobotLogs.ts`, `components/RobotLogsButton.tsx`, `RobotLogsDialog.tsx`, `RobotLogRow.tsx`, `RobotLogsFooter.tsx`; changed `components/SavedLogGroup.tsx`, `LogLibrary.tsx`, `OpenLogPrompt.tsx`, `LogsPanel.tsx`, `scripts/log-check.mjs`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Pull Logs from the Robot](../11-Ideas/Pull%20Logs%20from%20the%20Robot.md), [Ideas](../11-Ideas/INDEX.md)
- **Testing:** new `scripts/fake-robot.mjs` (a pretend roboRIO SFTP server) and `scripts/robot-logs-check.mjs` (`npm run check:robot-logs`: find, log in, list, download byte for byte, skip existing). `POWERLIB_ROBOT=host[:port]` points Power Tool at a test robot.
- **Branch / commit:** feature/Log-Viewer, not committed yet. Tested against the fake robot, not a real one yet.

## 2026-11-03: Logs tab lists the logs folder; open logs live in context
- **What:** The Logs tab's Open log button opens a popup listing every run in a logs folder (default `Documents\Power Tool\Logs`, changeable), grouped by event (Matches, the default) or by week (Practice), with search. Matches are named from Phoenix/DataLogManager file names ("Qual 6", "Elim 3"); each row also shows when it ran and its size (`powerlib:list-logs` returns file sizes). With a log open, a **Logs** button in the status bar opens the same list in a drawer (above the app bar). The popup and drawer share one flat frame (`logsSurface`) so their colors match the tab's cards. The open log moved into a `LoadedLogsProvider` context, and the last 3 logs opened from the list stay parsed for instant switching. New IPC `powerlib:list-logs`, `open-log-files`, `choose-logs-folder`, `default-logs-folder`; `readLogFile` now reads through `readLogFiles`. `readFieldSettings` moved to `logUtils.ts`. `LogStatusBar`'s Open log button became Logs.
- **Why:** Opening a log meant hunting through File Explorer. Mentor feedback: use a drawer, not a popup, and keep wanted state above components that unmount.
- **Files:** `powerlib-dashboard/electron/main.ts`, `electron/preload.cts`, `src/types/electron.d.ts`, `src/main.tsx`, `src/features/logs/LogsPanel.tsx`, `useLogFile.ts`, `logUtils.ts`, new `logLibraryModel.ts`, `useLogLibrary.ts`, `useLoadedLogs.ts`, `loadedLogsContext.ts`, `LoadedLogsProvider.tsx`, `components/LogLibrary.tsx`, `LogLibraryToolbar.tsx`, `SavedLogGroup.tsx`, `SavedLogRow.tsx`, `LogFolderBar.tsx`, `LogsDrawer.tsx`, `LogsDialog.tsx`, changed `components/OpenLogPrompt.tsx`, `LogStatusBar.tsx`, `scripts/log-check.mjs`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Built-in Log List](../11-Ideas/Built-in%20Log%20List.md), [Ideas](../11-Ideas/INDEX.md)
- **Branch / commit:** feature/Log-Viewer, not committed yet

## 2026-11-02: Logs tab motor graphs show each motor and their average
- **What:** In a graph tile's Current, Voltage and Stator views, a subsystem with two or more motors draws each motor as a thin line (name on hover) under a bold average line, instead of one summed line. New `motorAverage` and `motorSignalFor` in `logModel.ts` (checked in `log-check.mjs`); `PlotChart` takes `extraLines`. The motor axis spans each motor's 0.1 s means plus zero (real peaks fit; single-sample noise doesn't stretch it), motor lines are drawn smoothed over 0.1 s and faint, and every chart now shades down to zero instead of to the bottom edge.
- **Why:** Mentor feedback: one bad motor hides inside a subsystem total.
- **Files:** `powerlib-dashboard/src/features/logs/logModel.ts`, `components/PlotChart.tsx`, `components/SubsystemPlot.tsx`, `powerlib-dashboard/scripts/log-check.mjs`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab motor graphs have a key; pick the bold line
- **What:** Graphs with per-motor lines show a key (Avg, then each motor by CAN ID) in the line colors. Clicking an entry makes that line bold and shaded, fades the others, and the header shows that line's value. New `LineKey`; `PlotChart` takes `focus` and colored `extraLines`; `motorLineColor` in `logUtils.ts`.
- **Why:** With 8 drive motors you couldn't tell which line was which or follow one motor.
- **Files:** `powerlib-dashboard/src/features/logs/components/LineKey.tsx`, `PlotChart.tsx`, `SubsystemPlot.tsx`, `logUtils.ts`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab uses the 3-column layout only
- **What:** The 3-column layout (graphs, vertical field, Power card) is the only layout. The 2 columns / 3 columns switch, `LayoutToggle`, the saved `powerlib.logs.layout.v1` choice, the 2-column arrangement in `LogsLayout`, and `LogStatusBar`'s `actions` slot are removed.
- **Why:** The team and mentor picked 3 columns.
- **Files:** `powerlib-dashboard/src/features/logs/LogsPanel.tsx`, `components/LogsLayout.tsx`, `components/LogStatusBar.tsx`; removed `components/LayoutToggle.tsx`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Vertical Field Layout](../11-Ideas/Vertical%20Field%20Layout.md)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab graphs are tiles, half height, two across
- **What:** Subsystem graphs are now tiles, two across when there's room. Each tile has a header with the value now in large type and the setpoint after an arrow, compact view buttons, and a restyled chart: shaded under the line, faint dashed grid, rounded line, and per-tile time labels. Charts are 90 px (170 px on windows at least 1000 px tall). New `PlotChart` and `SubsystemPlotHeader`; `areaPath` in `logUtils.ts`.
  - Each tile is an outlined card with a stripe down its left edge in the subsystem's Power card color (`colorOf` on `SubsystemGraphs`). `colorLines` draws the lines in that color too; it's off by default. Styles A/B/C were screenshotted for the mentor to choose from.
- **Why:** Mentor feedback: prettier graphs, cut in half and tiled; must work at 1280x720 and 1920x1080.
- **Files:** `powerlib-dashboard/src/features/logs/components/SubsystemGraphs.tsx`, `SubsystemPlot.tsx`, `SubsystemPlotHeader.tsx`, `PlotChart.tsx`, `GraphViewSelector.tsx`, `logUtils.ts`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab field heat map, 3-column order and fixed Power card width
- **What:** The field card has a **Position | Heat map** toggle; the heat map shows where the robot spent its enabled time (`poseHeatmap` in `logModel.ts`, checked in `log-check.mjs`). The field is split into `FieldCanvas`, `RobotPose` and `FieldHeatmap`. The 3-column layout is now graphs, field, Power card, with the Power card fixed at 400 px.
- **Why:** Mentor feedback on the 3-column layout.
- **Files:** `powerlib-dashboard/src/features/logs/logModel.ts`, `components/FieldView.tsx`, `FieldCanvas.tsx`, `RobotPose.tsx`, `FieldHeatmap.tsx`, `LogsLayout.tsx`, `LogsPanel.tsx`, `powerlib-dashboard/scripts/log-check.mjs`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab shows the match clock and an FMS tag
- **What:** The play bar shows the Driver Station's match countdown ("1:45 left") from `Drive/MatchTimeSeconds`, and an FMS tag when the robot was on a field (`RobotStatus/FmsAttached`, or Owlet's `DS:IsFMSAttached`). `LogModel` gains `matchTime` and `fmsAttached`; new `matchClockAt` and `formatMatchClock`. The sample log has both, and `log-check.mjs` checks them. Logs without a logged match time (e.g. Owlet-only exports) show no clock.
- **Why:** To line up a log with game time and tell real matches from practice.
- **Files:** `powerlib-dashboard/src/features/logs/logModel.ts`, `logUtils.ts`, `components/PlayBar.tsx`, `LogsPanel.tsx`, `powerlib-dashboard/scripts/log-check.mjs`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab Power card in amps, fixed-height graphs, no setpoint table
- **What:**
  - A 3-column layout to try (mentor's idea): Power card, the field standing up with the driver station side at the bottom, then the graphs. A **2 columns | 3 columns** switch in the status bar flips between layouts (saved). New `LogsLayout`, `LayoutToggle`; `FieldView` takes `orientation`; `PowerCard` takes `graphHeight`; `LogStatusBar` has an `actions` slot.
  - Subsystem graphs are a fixed 140 px each; the list scrolls.
  - The Subsystem status table (value, setpoint, error, overshoot, settle time) is gone; the setpoint stays in the graphs.
  - New Power card: stacked supply current in amps, a divider, then a table of Subsystem, Current and Temp. One subsystem's motors open at a time. Header shows robot current, battery voltage and Assign motors. It follows the Subsystems picker.
  - `powerGroups` in `logModel.ts` now carries each group's summed `current` as well as `power`.
  - Each widget stays a standalone component (mentor's direction), so other layouts only change `LogsPanel.tsx`.
- **Why:** Mentor feedback: temps, current draw and position matter most; setpoint numbers in a table repeat the graphs; the team thinks in amps.
- **Files:** `powerlib-dashboard/src/features/logs/**` (new `PowerCard`, `CurrentGraph`, `PowerTable`, `PowerTableRow`, `PowerMotorRow`; removed `PowerWidget`, `SubsystemStatus`, `StatusRow`, `MotorStatusRow`, `useElementHeight`), `powerlib-dashboard/scripts/log-check.mjs`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Vertical Field Layout](../11-Ideas/Vertical%20Field%20Layout.md) (saved idea)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab fits the window, play bar at the bottom, one component per file
- **What:**
  - Fits small screens too (checked at 1280x720): the status table moved into the right column under the field and power; the field keeps most of the height; table cells don't wrap, and under 600 px the table hides Overshoot and Settle time so value, setpoint and error stay readable.
  - Graph views are Position/Velocity, Current, Voltage and Stator. Power and Temp buttons are gone: power has its own widget, and the hottest motor's temperature shows next to the subsystem name.
  - Power widget: the "Picked N W of M W" line is gone; robot total and battery moved into its header; the chart is shorter and the legend is one line.
  - The Logs tab fills the window with no page scrollbar; the subsystem graphs and status table scroll on their own with a thin dark scrollbar.
  - Play bar moved to the bottom on one row: play, speed, time with period and robot state, a timeline (periods plus state; click or drag to seek) and a segmented Auto | Teleop switch. The keyboard hint text, problem chips, slider, "Jump to" chips and the separate state strip are gone.
  - New status bar along the bottom edge: Open log, file name, log details and CAN %.
  - "Mechanism" is now "Subsystem" everywhere on screen; the picker is labeled Subsystems; "20 s window" is gone from titles.
  - Each graph's view dropdown is now a segmented row across the top of the graph. Graphs share the widget's height.
  - Setpoint line is purple; the legend says "Setpoint not logged" when the log has none.
  - Status table drops the Current and Power columns; subsystems with motors expand to one row per motor. The big Battery tile is removed (battery stays in the power widget).
  - The empty Logs screen no longer explains Owlet; the error explains it when it's needed.
  - `log-check.mjs --write-sample` now also writes fake TalonFX motors (drive 1-8, one or two per mechanism) so the sample fills every widget; the check asserts they group correctly.
  - `LogWidgets.tsx`, `PowerWidgets.tsx` and most of `LogsPanel.tsx` split into `components/` (one component per file), hooks `useLogFile`, `useLogPlayback`, `useElementHeight`, and `logUtils.ts`. Added `canPercentAt` to `logModel.ts`.
- **Why:** The tab wasted space and needed page scrolling, and the play bar was crowded. The Logs files broke the one-component-per-file rule.
- **Files:** `powerlib-dashboard/src/features/logs/**`, `powerlib-dashboard/src/App.tsx`, `powerlib-dashboard/scripts/log-check.mjs`
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [React Code Rules](../05-Power-Tool/React%20Code%20Rules.md), [Problem Markers](../11-Ideas/Problem%20Markers.md), [Mechanism Picker](../11-Ideas/Mechanism%20Picker.md), [Tests and Checks](../07-Testing/Tests%20and%20Checks.md)
- **Branch / commit:** not committed yet

## 2026-11-02: Logs tab shows current, power and voltage per mechanism
- **What:**
  - Opening a `.hoot` opens the whole match: every `.hoot` in the folder with the same session timestamp (one per CAN bus), merged on one clock.
  - Owlet now exports only the signals the viewer uses (`--scan` then `-s`). A CANivore export dropped from ~1 GB to ~130 MB.
  - Reads Phoenix's auto-logged Talon FX signals and **groups motors automatically** when a log opens:
    - CAN IDs from `powerlib-subsystems.json`;
    - swerve IDs from the robot's `TunerConstants.java` (new `powerlib:read-drive-motor-ids` IPC);
    - otherwise matching each motor's motion to a mechanism (correlation ≥ 0.9);
    - with a labeled guess of Drive for leftover IDs 1–8.

    The **Assign motors** dialog shows how each motor was grouped and lets you fix it.
  - Each mechanism graph has a view selector: value vs setpoint, supply current, power, applied voltage, stator current or temperature.
  - New **power widget**: power stacked over time for **only the mechanisms picked in the Mechanisms dropdown**, with "Picked N W of M W robot total" and battery voltage. Colors stay the same whatever is picked, and the scale fits the picks.
  - The status table gains current and power columns.
  - **Steady motor displays:** motor current is noisy at ~100 Hz, and the first version bounced during playback. Now:
    - the power widget stacks means of fixed 0.1 s slots, uses one y-scale for the whole log, and keeps its legend in a fixed order (by average power);
    - motor-reading graphs draw means of fixed sample groups;
    - amp, watt and battery readouts are 0.5 s averages, so the widget and the Battery tile agree.
  - The parser can skip unused signals.
- **Why:** See which mechanism draws the most current or power, e.g. during a brownout.
- **Files:**
  - new: `powerlib-dashboard/src/features/logs/PowerWidgets.tsx`;
  - changed: `src/features/logs/logModel.ts`, `wpilog.ts`, `LogsPanel.tsx`, `LogWidgets.tsx`, `electron/owlet.ts`, `electron/main.ts`, `src/types/electron.d.ts`, `scripts/log-check.mjs`.
- **Checks:**
  - `node scripts/log-check.mjs` (two-file session, motor mapping, power math, overrides, motion matching with gearing/offsets/inverted followers, TunerConstants and guessed Drive, rule precedence, Owlet helpers), the four other dashboard checks, `npm run build`.
  - Real 2026 MOSE Q8 rio + CANivore files, converted with the new Owlet code: all 18 motors grouped with no setup (10 by motion at 0.989–1.000, IDs 1–8 guessed as Drive). Load plus grouping took about 1 s. In the browser, the power widget filled in on open.
  - Stepping one sample at a time on Q8: the legend order and the 2,500 W scale stayed fixed, chart points were identical between frames, and readouts changed smoothly.
  - A reported "0 W while spinning" was real: the roller's applied voltage dropped to 0 V (turned off, coasting).
  - Picked Shooter + Feeder: the widget showed only those two (1,500 W scale, "Picked 306 W of 907 W"). Adding Drive through the dropdown added it live with unchanged colors for the others.
  - Not yet tested end to end in the Electron app.
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Power Tool Architecture](../05-Power-Tool/Power%20Tool%20Architecture.md), [Mechanism Power and Current](../11-Ideas/Mechanism%20Power%20and%20Current.md), [Reading wpilog and hoot](../11-Ideas/Reading%20wpilog%20and%20hoot.md), [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md)
- **Branch / commit:** feature/Log-Viewer (uncommitted)

## 2026-10-31: Logs tab shows several mechanisms at once, timeline on top, steady graphs
- **What:**
  - The mechanism dropdown is now a multi-select. Each picked mechanism gets its own graph, stacked on the same time window with one cursor.
  - The at-setpoint box and setpoint-error widget are replaced by one status table with a row per mechanism.
  - The selection is remembered (localStorage) for the next log, and clicking a problem marker adds its mechanism.
  - The timeline (play, speed, markers, slider) moved from the bottom to the top, under the file name.
  - Graph lines no longer shimmer during playback: when a window has more samples than are drawn, the kept samples are now fixed positions in the log instead of positions relative to the moving window.
  - Values that round to zero no longer show as `-0.0`.
- **Why:** Compare mechanisms that work together, like shooter and hood while scoring; reach playback without scrolling; the wiggle was reported from the Electron app during playback.
- **Files:** `powerlib-dashboard/src/features/logs/LogsPanel.tsx`, `powerlib-dashboard/src/features/logs/LogWidgets.tsx`.
- **Checks:** `node scripts/log-check.mjs`, `npm run build`. Browser tests:
  - picked three mechanisms through the dropdown, then reloaded to confirm the selection is kept;
  - stepped the slider one sample at a time and confirmed the drawn points stayed identical (and confirmed the wiggle is gone in the Electron app);
  - confirmed the timeline sits above the graphs.
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Mechanism Picker](../11-Ideas/Mechanism%20Picker.md), [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md)
- **Branch / commit:** feature/Log-Viewer (uncommitted)

## 2026-10-31: Power Tool Logs tab (log viewer v1)
- **What:**
  - New **Logs** tab that replays a robot log. It opens `.wpilog` directly and `.hoot` through CTRE's Owlet, from a file dialog or by drag-and-drop.
  - Fixed layout:
    - a mechanism graph with a dropdown (value vs setpoint);
    - the field with a pose trail;
    - an at-setpoint box, battery, and setpoint error / overshoot / settle time;
    - the `ActualState` strip;
    - a timeline with match periods, problem markers (brownout, CAN, setpoint miss), playback and keyboard controls.
  - Hand-written `.wpilog` reader. Graphs are plain SVG; no new dependencies.
  - **Owlet:** finds AdvantageScope's cached Owlets and runs the one matching the log's `.hoot` format version, via `owlet <hoot> --compliancy`.
  - **Older logs:** reads Owlet's built-in signals (`Voltage`, `CAN Utilization`, `RobotMode`, `RobotEnable`) and plain `<Name> Velocity`/`Position` names, so pre-PowerLib logs still show mechanisms, battery and match periods.
- **Why:** Review matches and practice runs inside Power Tool, built from the ideas in [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md).
- **Files:**
  - new: `powerlib-dashboard/src/features/logs/` (`wpilog.ts`, `logModel.ts`, `LogsPanel.tsx`, `LogWidgets.tsx`), `powerlib-dashboard/electron/owlet.ts`, `powerlib-dashboard/scripts/log-check.mjs`;
  - changed: `powerlib-dashboard/electron/main.ts` (`powerlib:open-log`, `powerlib:open-log-path`, Owlet folders), `electron/preload.cts`, `src/types/electron.d.ts`, `src/types/app.ts`, `src/App.tsx`, `package.json` (`check:logs`), `tests/README.md`.
- **Checks:**
  - `node scripts/log-check.mjs`, the four existing dashboard checks, and `npm run build`.
  - Browser tests: dropped the synthetic match and a real converted 2026 competition log on the tab.
  - `owlet.ts` converted two real `.hoot` logs (format version 19).
  - Opening a real `.hoot` from the Open log dialog works end to end in the Electron app.
  - Not yet tested: a log from a PowerLib robot.
- **Notes updated:** [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Power Tool Architecture](../05-Power-Tool/Power%20Tool%20Architecture.md), [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md), [Tests and Checks](../07-Testing/Tests%20and%20Checks.md), [Change to Tests Map](../07-Testing/Change%20to%20Tests%20Map.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md), [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md) and its idea notes
- **Branch / commit:** feature/Log-Viewer (uncommitted)

## History before the vault (from git log)

### 2026-10-13 → 2026-10-29: Vision hardening
- Guarded vision heading correction (MegaTag1 heading fused separately from MegaTag2 X/Y).
- Disabled-mode heading initialization with a strict single-tag fallback (`VisionHeadingInitializer`).
- Tilt filtering of captures and validation of large position corrections (`VisionPoseFilter`).
- Per-camera fusion and heading-camera selection (`VisionMeasurementFusion`,
  `VisionHeadingSelector`, `VisionHeadingReadiness`), with large new test suites. *(12e7831 "Vision Updates")*
- Limelight configuration fixes and camera stream recovery in Power Tool. *(df6cee8)*
- Optional `statorCurrentLimitAmps` for velocity subsystems. *(08a9238)*

### 2026-10-06 → 2026-10-14: Telemetry, Drive dashboard, state handlers
- Reusable multi-Limelight vision support (`LimelightVision`). *(6f7b559)*
- Constants editor; tuning and constants editing moved into Robot-tab cards. *(7bb4043, d43ebc2)*
- Fixed tunable discovery across NT4 reconnects. *(dde36f4)*
- Generic Drive dashboard and shared telemetry logging; switched to the 100 ms complete-frame
  publish at `/PowerLib/Data`. *(ad12475, 84a2c66)*
- Robot state handlers (`State<R,M>`), owned state requests, `ButtonBindings`, `HealthChecks`,
  autonomous templates (`Auto`, `AutoBuilder`, `RobotAutos`). *(5f73c86, 4f61d40)*
- Project-owned `power-tool/dashboard/` preserved across updates; extension slots. *(bac6c46)*
- Installer simplified; Power Tool files organized under `power-tool/`. *(85901c1)*
- Power Tool button-binding generation removed (bindings live in `RobotContainer`). *(f09b21c)*

### 2026-07-24 → 2026-07-27: Tuning
- Switched the dashboard from SmartDashboard to the NetworkTables library. *(336bd2a)*
- Tuning tab, then a tuning drawer on the Robot tab, tuning toggle, value saving, search. *(179e988 → 455c2c9)*
- Tunables and configs for the Phoenix Pro generated swerve; generator script fixes. *(8b0bfa5, 007b929)*
- First Limelight detection/tag support. *(2410645)*

### 2026-05-15 → 2026-05-18: Agent skills
- Added the `skills/` folder with the `powerlib-sim` MapleSim skill and taught the installer to
  copy it. *(Sim-Skill branch, merged 4e5621c)*

### 2026-05-09 → 2026-05-13: Foundations
- Initial scaffolding: `install.ps1` + `install.gradle`, cleanup/backup steps, vendordep install
  with MapleSim pin and `latest` flag.
- PowerLib subsystems and configs, state machine and LED templates, drivetrain/vision/starter
  constants, `DriveUtil`.
- PowerShell subsystem generator with update-from-JSON mode.
- Electron dashboard app, renamed **Power Tool**: subsystem editor, characterization routines,
  IO generation, NetworkTables tree view, Robot tab, velocity-torque and absolute-position
  subsystems, button-binding generator (later removed), Update Power Tool scripts, branch-aware
  installs (`-RepoRef`), `.template` naming for existing files.

Related: [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md), [Maintaining This Vault](../Maintaining%20This%20Vault.md)
