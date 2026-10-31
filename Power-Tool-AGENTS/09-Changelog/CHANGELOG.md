---
title: Changelog
date: 2026-10-30
tags: [changelog]
---

# Changelog

Newest first. Add an entry for every change we make to Robot-Library: what changed, why, the
files touched, and the notes in this vault that were updated. Older history (before this vault
existed) is summarized from `git log` and grouped by period.

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

## 2026-10-30: Vault correctness fixes (second Codex review)
- **What:**
  - Adding a Robot State now includes the extra `requestsChanged = true` change. The first loop runs the first handler in the list, which is harmless in the shipped template (Idle only) but wrong once a handler is placed before Idle.
  - Relative startup is a coordinate reset, not physical homing.
  - SignalLogger records only while running; practice without an FMS records nothing by default. Added how to confirm.
  - Power Tool's UI only edits existing constant values.
- **Files:** `Power-Tool-AGENTS/**` only. No code changed. The shipped `StateMachine.java` is correct as-is.
- **Branch / commit:** feature/Log-Viewer (uncommitted)

## 2026-10-30: Vault review additions (from a Codex review)
- **What:** Added `10-Guides/`:
  - First Robot Walkthrough;
  - File Ownership and Precedence;
  - Units and Coordinates;
  - Configuration Examples;
  - Robot Lifecycle;
  - Adding a Robot State;
  - Troubleshooting.

  Also added Mechanism Behavior (PowerLib), a vision behavior-by-mode and log-status table, and a Change to Tests Map.
- **Corrected:**
  - `mechanismHealthy` is false for unconfigured mechanisms even in sim.
  - Live tuning has no guaranteed end-to-end delay.
  - The dashboard field size (16.54 × 8.07 m) differs from the vision bounds (17.548 × 8.052 m).
  - Adding a custom constant in Java alone is overwritten once the file is tracked in `powerlib-constants.json`.
- **Why:** Make the reference notes usable step by step, and fix inaccuracies the review found.
- **Files:** `Power-Tool-AGENTS/**` only. Added `.tools/vault_lint.py` (MIT, from obsidian-notes) so linting is reproducible.
- **Branch / commit:** feature/Log-Viewer (uncommitted)

## 2026-10-30: Added the Power-Tool-AGENTS vault
- **What:** Created this Obsidian vault documenting how the library, installer, robot templates,
  Power Tool and tests work and connect, plus this changelog and the
  [Log Viewer Project](Log%20Viewer%20Project.md) note.
- **Why:** Groundwork before building the Power Tool log viewer, so humans and agents have a
  map of the codebase and a record of changes.
- **Files:** `Power-Tool-AGENTS/**` (docs only; no code changed). The installer downloads files
  by explicit path, so this folder is never copied into robot projects.
- **Branch / commit:** feature/Log-Viewer (uncommitted)

---

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

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Maintaining This Vault](../Maintaining%20This%20Vault.md)
