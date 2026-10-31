---
title: Glossary
date: 2026-10-30
tags: [overview, glossary]
---

# Glossary

| Term | Meaning |
|---|---|
| **Robot-Library** | This repo: installer + PowerLib + templates + Power Tool + skills |
| **PowerLib** | The reusable Java library, package `frc.powerlib`. See [PowerLib index](../03-PowerLib/INDEX.md) |
| **Power Tool** | The Electron desktop dashboard (`powerlib-dashboard/`, installed as `power-tool/`). See [Power Tool Architecture](../05-Power-Tool/Power%20Tool%20Architecture.md) |
| **Template / replacement file** | Starter `frc.robot` code from `templates/replacements/`. Owned by the team after the first install |
| **`.template` file** | An updated template written *beside* the team's file on later installs, e.g. `RobotContainer.java.template` |
| **`.powerlib.bak`** | Backup made before a first-install replacement; deleted unless `-PpowerlibKeepBackups=true` |
| **Generated JSON** | `power-tool/generated/powerlib-subsystems.json` and `powerlib-constants.json`: source of truth for generated Java |
| **Update Code** | Power Tool menu action that runs `generate-subsystem.ps1 -UpdateSubsystems` |
| **Custom constants block** | Code between `POWERLIB CUSTOM CONSTANTS START/END` markers, preserved by the generator |
| **Owner** | First level of the shared data and variables maps; usually a subsystem name (`Drive`, `Swerve`, `Intake`) |
| **Tunable / variable** | A value exposed at `/PowerLib/Subsystems/<Owner>/Variables/<key>` for live editing |
| **`@TunableConstant`** | Annotation on a `public static volatile` numeric constant that makes it live-tunable as `Custom/<NAME>` |
| **Tuning mode** | Robot-acknowledged switch (`/PowerLib/Tuning/Enabled`); edits apply only while on |
| **NT / NT4** | WPILib NetworkTables v4, the robot ↔ dashboard pub/sub protocol (port 5810) |
| **`/PowerLib/Data` frame** | The 10 Hz JSON snapshot of all subsystem data. See [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md) |
| **SignalLogger** | CTRE Phoenix 6 logger; writes `.hoot` files on the roboRIO at 50 Hz for PowerLib signals |
| **`.hoot`** | CTRE's log format. Convert with Owlet/Tuner X to `.wpilog` or CSV |
| **`.wpilog`** | WPILib DataLog format, read by AdvantageScope |
| **AdvantageScope** | WPILib log and live-data viewer; uses the `Pose2d` struct topic |
| **MegaTag1 / MT1** | Limelight's tag-only pose (`botpose_wpiblue`); PowerLib uses only its heading |
| **MegaTag2 / MT2** | Limelight's gyro-assisted pose (`botpose_orb_wpiblue`); PowerLib uses only its X/Y |
| **IO Real / IO Sim** | Hardware vs. simulated implementations of a mechanism's IO interface |
| **ConfigurationQueue** | Background thread that applies CTRE config changes without blocking the loop |
| **TuningCadence** | 0.2 s (5 Hz) rate limiter for tuning work |
| **MapleSim** | Physics sim library (pinned 0.4.0-beta) used by the `powerlib-sim` skill |
| **Characterization** | SysId routines generated for velocity subsystems and triggered from Power Tool |
| **State handler** | A `State<R, M>` implementation; `StateMachine` picks the first matching handler by list order |
| **Owner (state request)** | Object identifying who made a state request; one request per owner |

Related: [Architecture](Architecture.md), [Home](../README.md)
