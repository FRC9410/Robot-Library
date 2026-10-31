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
