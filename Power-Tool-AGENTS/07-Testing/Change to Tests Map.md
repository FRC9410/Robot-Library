---
title: Change to Tests Map
date: 2026-10-30
tags: [testing, checklist]
---

# Change to Tests Map

Before you commit, find the row that matches your change and run its checks. How to run each one,
and what it needs: [Tests and Checks](Tests%20and%20Checks.md).

| If you change… | Also update | Run |
|---|---|---|
| **Add/rename/remove a file in `templates/powerlib/`** | the `templateFiles` manifest in `install.gradle` (+ deprecated-file list if removing) | `generator-checks.ps1` (manifest check), `run-library-checks.ps1`, `generated-robot-check.ps1` |
| PowerLib logic (subsystems, configs, tuning, auto…) | matching JUnit test in `tests/java/frc/powerlib/...` | `run-library-checks.ps1`, then `generated-robot-check.ps1` |
| **Telemetry** (`SubsystemTelemetry`, `DriveTelemetry`, frame shape, keys) | `tests/TELEMETRY-CONTRACT.md`, `DataSnapshot.ts`/`driveModel.ts` aliases | **Both sides:** `run-library-checks.ps1` (writes the Java fixture), then `node scripts/telemetry-buffer-check.mjs --java-fixture` and `drive-model-check.mjs` |
| Vision classes or `Vision.java` | README vision section, [Vision Pipeline](../03-PowerLib/Vision%20Pipeline.md) | `run-library-checks.ps1` (six vision suites), `generated-robot-check.ps1`; then validate on the robot |
| `StateMachine`/`IdleState`/`RequestState` templates | — | `state-machine-check.ps1` (after `run-library-checks.ps1`) |
| Robot templates (`templates/replacements/`) | `install.gradle` entry if adding a file | `generated-robot-check.ps1` (fresh install + compile + reinstall) |
| **`generate-subsystem.ps1`** (output, migrations, JSON schema) | `powerlib-dashboard/src/features/subsystems/types.ts` if the schema changes | `generator-checks.ps1` (idempotence, Unicode, fr-FR culture), `generated-robot-check.ps1` (runs the generator three times) |
| `PowerDashboard.java` template | the generator's `Ensure-*` migrations | `generator-checks.ps1`, `generated-robot-check.ps1` |
| **Install/update scripts** (`build-dashboard-install.ps1`, `update-power-tool.ps1`, `project-layout.ps1`) | — | `pwsh -File ./tests/dashboard-update-check.ps1` (proves `dashboard/` and `generated/` survive byte-for-byte) |
| Power Tool NT layer (`nt4Client`, `TopicViews`, subscriptions) | — | `node scripts/subscription-check.mjs`, `telemetry-buffer-check.mjs` |
| Tuning UI / `TuningModeSync` / `robotModel` | — | `node scripts/tuning-check.mjs` (+ `TuningCadenceTest` if robot-side) |
| Drive tab / `driveModel` / `drive-template.json` | — | `node scripts/drive-model-check.mjs` |
| **Cameras / Limelights tab / CSP in `index.html`** | — | `npm run check:cameras` and, from `powerlib-dashboard/`: `node_modules/electron/dist/electron.exe scripts/camera-electron-check.cjs` |
| Any Power Tool TypeScript | — | `npm run build` (type-check + bundle) |
| **New log viewer code** | a new `scripts/<name>-check.mjs` + list it in `tests/README.md` | its check + `npm run build` |

## Local checks vs. another project's regressions
- Everything above runs **in this repo**.
- `tests/README.md` also mentions `tests/competition-checks.init.gradle` / `verifyRobot` and "native SOTM regressions". **Those files aren't in this repo.** They belong to a team robot project. Run them there after adopting a library change.
- None of these checks measure roboRIO timing, CAN load or real camera calibration. Those need the robot.

Related: [Tests and Checks](Tests%20and%20Checks.md), [Maintaining This Vault](../Maintaining%20This%20Vault.md), [Installer Flow](../02-Install-and-Update/Installer%20Flow.md)
