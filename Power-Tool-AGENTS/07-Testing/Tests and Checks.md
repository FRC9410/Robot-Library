---
title: Tests and Checks
date: 2026-10-30
tags: [testing]
---

# Tests and Checks

Everything runs locally on Windows. There's no Gradle build for the library itself, so the
scripts compile the files directly. Coverage tables: `tests/README.md`. Telemetry contract:
`tests/TELEMETRY-CONTRACT.md`.

## Requirements
- WPILib 2026 installed (`%PUBLIC%\wpilib\2026`, which provides the JDK and Maven jars).
- A Gradle cache that already has Phoenix 6, PathPlanner and JUnit. In practice: you've built a WPILib robot project on this machine.
- `npm ci` in `powerlib-dashboard/` for the dashboard checks.

## Run everything (repo root, PowerShell 7, in this order)

```powershell
./tests/run-library-checks.ps1      # compiles PowerLib + JUnit tests, must run first
./tests/state-machine-check.ps1
./tests/generator-checks.ps1
./tests/generated-robot-check.ps1   # end-to-end install + generator into a fixture project
Push-Location powerlib-dashboard
node scripts/telemetry-buffer-check.mjs --java-fixture
node scripts/drive-model-check.mjs
node scripts/subscription-check.mjs
node scripts/tuning-check.mjs
npm run build
Pop-Location
pwsh -File ./tests/dashboard-update-check.ps1   # separate process
```

## What each script does
- **`run-library-checks.ps1`**
  - Copies WPILib and Gradle-cache jars into `build/library-checks/dependencies`.
  - Compiles `templates/powerlib/**` (except `utils/`, since `DriveUtil` depends on `frc.robot`) plus `tests/java/**` with the WPILib `javac`.
  - Runs JUnit 4.
  - Also writes `build/library-checks/telemetry-frame.json`, which the dashboard's `--java-fixture` check reads. That way the Java and TypeScript sides check the same frame.
- **`state-machine-check.ps1`:** compiles the real `StateMachine`/`IdleState`/`RequestState` templates against stubs and runs `tests/state-machine/StateMachineCheck.java`: priority, owners, fallback, prepare-every-cycle.
- **`generator-checks.ps1`:** no Java. Loads functions from `generate-subsystem.ps1` via the PowerShell AST and checks:
  - every PowerLib file is in the `install.gradle` manifest;
  - migrations are idempotent and keep custom code and Unicode;
  - number formatting is culture-safe.
- **`generated-robot-check.ps1`:** installs into a fixture project with the repo's own `install.gradle`, generates all four subsystem types, checks the output and compiles. Runs the generator three times to prove idempotence.
- **`dashboard-update-check.ps1`:** fake install and update with npm mocked. Proves `power-tool/dashboard/` and `generated/` survive byte-for-byte.

## JUnit suites (`tests/java/frc/powerlib/…`)
| Area | Tests |
|---|---|
| Shared data | `SharedDataTest` |
| Auto | `AutoBuilderTest`, `AutoTest` |
| Controls | `ButtonBindingsTest` |
| Telemetry | `TelemetryContractTest` (writes the fixture frame; logs every loop while NT is throttled) |
| Health / math | `HealthChecksTest`, `LinearInterpolatorTest` |
| Subsystems | `ConfigurationQueueTest`, `ConfigurationValidationTest`, `MechanismSimulationTest`, `MotionProfileSequencingTest`, `MotorConfigurationTest`, `RelativeControlTest`, `RunningStateTest` |
| Tuning | `TuningCadenceTest` |
| Vision | `LimelightVisionTest`, `VisionHeadingInitializerTest`, `VisionHeadingReadinessTest`, `VisionHeadingSelectorTest`, `VisionMeasurementFusionTest`, `VisionPoseFilterTest` |

## Dashboard check scripts (`powerlib-dashboard/scripts/`)
These bundle TypeScript with esbuild and assert with `node:assert`. They also run via `npm run check:*`.
- `telemetry-buffer-check.mjs`: frame decode, buffer replacement, bad frames.
- `drive-model-check.mjs`: drive state, cameras, chooser, pose sources.
- `subscription-check.mjs`: view stability, subscription periods.
- `tuning-check.mjs`: tuning handshake, cards, value parsing, publish after reconnect.
- `camera-check.mjs` and `camera-electron-check.cjs` (run with Electron itself): camera failover and the Limelight iframe under the real CSP. **Not listed in `tests/README.md`.**

## Gaps
- `tests/README.md` mentions `tests/competition-checks.init.gradle` / `verifyRobot`, which **don't exist in this repo**. They belong to a separate robot project.
- These are desktop checks only. RoboRIO timing, CAN and CPU load aren't measured.

Related: [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md), [NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md), [Subsystem Generator](../02-Install-and-Update/Subsystem%20Generator.md)
