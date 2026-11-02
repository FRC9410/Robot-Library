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
- **Opening:** the Open log button (`window.powerlib.openLog`), or drag files onto the tab.
  - A `.hoot` opens its whole session (every CAN bus's file from that match) through Owlet. See [Power Tool Architecture](Power%20Tool%20Architecture.md).
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
- `LogsPanel.tsx` + `LogWidgets.tsx`: fixed layout, top to bottom.
  - Timeline, directly under the file name so it's always reachable: play/pause, 0.5–4x speed, problem-marker chips, the period/marker bar and a slider. Details below.
  - Then `MechanismGraphs` and the field with a 3 s trail.
    - Graphs draw at most ~900 points per line. When a window has more samples, `seriesPath` keeps every Nth sample of the whole log (N fixed by window length), so the same samples stay drawn while the window slides. Choosing them relative to the window made lines shimmer during playback. The field uses the Drive tab's field size and flip settings.
    - A multi-select dropdown picks mechanisms. Each one gets its own value-vs-setpoint graph, stacked on the same 20 s window with one cursor, so different units never share an axis.
    - Graphs get shorter as more are added (200 / 120 / 88 px).
    - The selection is saved in localStorage (`powerlib.logs.mechanisms.v1`), and the next log opens with the same mechanisms if it has them; otherwise `busiestMechanism`.
    - Each graph has a view selector: value vs setpoint, supply current, power, applied voltage, stator current or motor temp (only the readings it has). Saved per mechanism in `powerlib.logs.graphViews.v1`.
    - **Motor readings are noisy** (logged at ~100 Hz, jumping between samples), so motor views draw each fixed group of samples as its mean (≥ 0.05 s per point, `seriesPath`'s `averageSeconds`). Their readouts use `averageAt` (mean of the last 0.5 s). Value views stay raw.
    - Right column, under the field: `PowerWidget` (`PowerWidgets.tsx`) stacks the power of **only the mechanisms picked in the Mechanisms dropdown** (power groups plus any picked single motors) over the same window.
      - It shows "Picked N W of M W robot total" and the battery voltage. With no picked mechanism that has motors, it says so and gives the robot total.
      - Each group's color comes from its place in the full `powerGroups` list, so it doesn't change with the selection.
      - To keep it steady during playback:
      - it stacks `slotMeans` (0.1 s slots at fixed positions in the log, so a sliding window doesn't re-sample);
      - its y-axis is one rounded scale from the picked groups' busiest 0.1 s over the whole log (it changes only when the picks change);
      - its legend keeps the groups' fixed order (average power over the log, unassigned last);
      - readouts are 0.5 s averages. The Battery tile uses the same average, so the two agree. Its **Assign motors** button opens `MotorAssignDialog`, which lists every motor with bus, peak current and how it was grouped (e.g. "Shooter · matched by motion 0.99"), for fixing mistakes. Choices are saved in `powerlib.logs.motorGroups.v1`; "Automatic" goes back to the automatic grouping.
  - Middle: `MechanismStatus` table, one row per selected mechanism (at setpoint, estimated when not logged; value; setpoint; error; overshoot; settle time; current; power), plus battery.
  - Below: `Drive/ActualState` strip.
  - Timeline: play/pause, 0.5–4x speed, match-period chips, problem-marker chips (clicking one jumps there and adds its mechanism to the selection), click-to-seek, slider. Space plays/pauses; arrows step 1 s (Shift 5 s).
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
3. Put the code in `src/features/<name>/`.
4. If it needs disk access, add an IPC handler in `electron/main.ts`, expose it in `preload.cts`, and type it in `src/types/electron.d.ts`.

Related: [Power Tool Architecture](Power%20Tool%20Architecture.md), [NetworkTables Layer](NetworkTables%20Layer.md), [Custom Dashboard](Custom%20Dashboard.md), [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md)
