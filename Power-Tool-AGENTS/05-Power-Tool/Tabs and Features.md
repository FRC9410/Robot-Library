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
- **Crew tools → "Export telemetry snapshot"** downloads a one-off `powerlib-drive-snapshot.json`. It's the closest thing to logging that exists today, and it isn't a recording.
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

## Adding a tab (e.g. a log viewer)
1. Add the value to `AppView` in `src/types/app.ts`.
2. Add a `<Tab>` and a panel branch in `App.tsx`.
3. Put the code in `src/features/<name>/`.
4. If it needs disk access, add an IPC handler in `electron/main.ts`, expose it in `preload.cts`, and type it in `src/types/electron.d.ts`.

Related: [Power Tool Architecture](Power%20Tool%20Architecture.md), [NetworkTables Layer](NetworkTables%20Layer.md), [Custom Dashboard](Custom%20Dashboard.md), [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md)
