---
title: Troubleshooting
date: 2026-10-30
tags: [guide, troubleshooting]
---

# Troubleshooting

Symptom → where to look → fix. Error strings are quoted exactly as the code prints them.

## Installation and builds
| Symptom | Where to look | Fix |
|---|---|---|
| "Run this from the root of a WPILib robot project." | install.ps1 output | `cd` to the folder that contains `gradlew.bat` |
| Install stops partway | Gradle output | `.powerlib.bak` backups stay next to the originals. Restore any you need and rerun. Rerun only the failed part with flags such as `-PpowerlibInstallVendordeps=false` |
| Closing `gradlew build` fails | Gradle output; run `.\gradlew build` again | Usually `TunerConstants.java` (replace it with your Tuner X output) or a merged `.template` file. Fix the compile error. `-PpowerlibSkipBuild=true` skips the check |
| Power Tool section fails (npm) | Installer output | Needs Node/npm and internet. The install fails instead of leaving a broken launcher. Rerun with `-PpowerlibInstall=false -PpowerlibInstallVendordeps=false` to retry only Power Tool |
| Installing a tag fails to download Power Tool | — | Only **branch** refs work (`archive/refs/heads/<ref>.zip`) |
| Your edits "disappeared" after reinstall | `*.template` files beside yours | Templates aren't overwritten after the first install; the new versions are in `X.template`. Merge by hand |

## Update Code (generator)
Power Tool shows only a short toast. For the **full output**, run from the robot root:
```powershell
.\power-tool\scripts\powerlib-update-subsystems.cmd
```

| Error | Cause / fix |
|---|---|
| `Missing src/main/java/frc/robot/<file>. Run robotLibraryInstall first.` | Constants, StateMachine or PowerDashboard is missing. Reinstall PowerLib |
| `Could not find POWERLIB GENERATED SUBSYSTEMS markers in StateMachine.java…` / `…CHARACTERIZATION markers in PowerDashboard.java…` | Restore the `// POWERLIB GENERATED … START/END - DO NOT DELETE` lines |
| `Invalid custom constants markers in <path>.` | The custom-block markers are broken or out of order |
| `Subsystem name '<x>' is reserved for robot constants.` / `… cannot contain spaces …` | Rename the subsystem (one token, not a reserved name) |
| `Subsystem '<x>' must have one leader motor.` / `… at least one motor.` | Fix `motors[]` |
| `Unsupported subsystem type …` / `Unsupported neutral mode …` | Use the accepted values listed in the message |
| `Saved type of <NAME> does not match robot code.` | The type in `powerlib-constants.json` differs from the Java declaration. Make them match |
| `Missing semicolon for constant <NAME>.` | Fix the Java syntax in that constants file |
| `Canonical dashboard is missing …` / `Could not find PowerDashboard …` | The generator's reference `power-tool/scripts/templates/PowerDashboard.java` is missing or stale, or your `PowerDashboard` was heavily rewritten. Run **Update Power Tool** (it recopies the template), then compare your file with the template |
| JSON parse error | Malformed `powerlib-subsystems.json`. Validate it, or restore it from git |
| Power Tool: "Invalid powerlib-constants.json configuration." | `version` must be `1` and `files` must be an object |

## Robot behavior
| Symptom | Where to look | Fix |
|---|---|---|
| Mechanism ignores commands | DS console: `PowerLib <name> startup config for <device> failed: <status>` | Check CAN ID, the **`canivore` bus**, power and firmware, then restart. `isConfigured()` stays false until restart |
| Tuning change didn't stick on the motor | DS: `PowerLib config <key> failed: <status>` | The queue retries every 500 ms or more while requested. Fix CAN, or revert the value |
| Tuning value refused | DS: `PowerLib tuning: <owner>/<key> rejected <raw>; expected <req>. Keeping <value>` | Enter a valid value (positive, non-zero ratio, in range) |
| Relative mechanism won't reach target | `getActivatedSetpoint()` ≠ `getSetpoint()` | Profile config still pending (CAN issue), or a `stop`/`setVoltage`/`zeroEncoder` cancelled it. See [Mechanism Behavior](../03-PowerLib/Mechanism%20Behavior.md) |
| `PowerLib shared data must be accessed on its robot thread` | Stack trace | Don't call `setSubsystemData`/variables from notifiers or other threads |
| Vision not correcting | SignalLogger `Vision/*` status keys | See "Troubleshooting with the logs" in [Vision Pipeline](../03-PowerLib/Vision%20Pipeline.md) |

## Power Tool
| Symptom | Where to look | Fix |
|---|---|---|
| Tuning switch stuck on "Tuning (syncing)" | NetworkTables tab: `/PowerLib/Tuning/RequestedEnabled` vs `/PowerLib/Tuning/Enabled` | The robot isn't acknowledging. Make sure the current code with `PowerDashboard` is deployed and running, and you're connected to the right host. Old `PowerDashboard` files are force-replaced by reinstalling PowerLib |
| Banner: "Unsupported telemetry frame. Showing the last valid readings…" | NetworkTables tab `/PowerLib/Data` | Robot and Power Tool disagree on the frame schema. Update both PowerLib (robot) and Power Tool to the same branch |
| Drive tab not live / stale cards | Heartbeat > 1.2 s old; header connection chip | Check the host (Connection Settings), the robot is on, and `PowerDashboard.periodic()` is running |
| Camera thumbnails fail | `/CameraPublisher/<name>/streams`; Limelight `http://<name>.local:5800` | Fix the URL in Drive → Crew tools (per camera). Embedded config is `:5801` on the Limelights tab. Run `npm run check:cameras` |
| Update Power Tool fails or app won't start after it | `build/power-tool-update.log` in the robot project | Often a custom `power-tool/dashboard/` that no longer compiles against new internals. Fix it, or temporarily restore the one-line default export (see [Custom Dashboard](../05-Power-Tool/Custom%20Dashboard.md)), then run `npm run build` in `power-tool/` |
| Robot/Subsystems tab shows no subsystems | Toast error from `readSubsystems` | `power-tool/generated/powerlib-subsystems.json` missing or invalid. Old root-level copies are migrated automatically, and conflicts go to `generated/legacy/` |

Related: [Tests and Checks](../07-Testing/Tests%20and%20Checks.md), [File Ownership and Precedence](File%20Ownership%20and%20Precedence.md), [Installer Flow](../02-Install-and-Update/Installer%20Flow.md), [Subsystem Generator](../02-Install-and-Update/Subsystem%20Generator.md)
