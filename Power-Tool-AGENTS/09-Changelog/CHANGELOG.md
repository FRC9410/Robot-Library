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
