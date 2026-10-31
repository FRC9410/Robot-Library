---
title: Power-Tool AGENTS (Home)
date: 2026-10-30
tags: [index, home]
aliases: [Home]
---

# Power-Tool AGENTS

A map of **Robot-Library** (Team 9410): how each part works, how the parts connect, and a running
changelog. Written for teammates and coding agents. Open this folder in Obsidian
(*Open folder as vault*) or read it on GitHub.

**Start here:** [Architecture](01-Overview/Architecture.md), then the
[First Robot Walkthrough](10-Guides/First%20Robot%20Walkthrough.md). **Changing code?** Follow
[Maintaining This Vault](Maintaining%20This%20Vault.md), check the
[Change to Tests Map](07-Testing/Change%20to%20Tests%20Map.md), and add a [CHANGELOG](09-Changelog/CHANGELOG.md) entry.

## 10 Guides: how to use it ([index](10-Guides/INDEX.md))
- [First Robot Walkthrough](10-Guides/First%20Robot%20Walkthrough.md): one mechanism from install to tuned values saved in Java.
- [File Ownership and Precedence](10-Guides/File%20Ownership%20and%20Precedence.md): what you may edit, what gets overwritten, which value wins.
- [Units and Coordinates](10-Guides/Units%20and%20Coordinates.md): rotations, rps, ratios, radians vs degrees, blue origin, field sizes.
- [Configuration Examples](10-Guides/Configuration%20Examples.md): copyable JSON for all four subsystem types and saved constants.
- [Robot Lifecycle](10-Guides/Robot%20Lifecycle.md): startup, disabled, auto, teleop, test; request cleanup and `reset()`.
- [Adding a Robot State](10-Guides/Adding%20a%20Robot%20State.md): a complete INTAKING state, start to finish.
- [Troubleshooting](10-Guides/Troubleshooting.md): symptom → where to look → fix.

## 01 Overview ([index](01-Overview/INDEX.md))
- [Architecture](01-Overview/Architecture.md): the five parts, repo layout, the connections that matter.
- [Glossary](01-Overview/Glossary.md): terms like MT1/MT2, owner, `.template`, `.hoot`.

## 02 Install and Update ([index](02-Install-and-Update/INDEX.md))
- [Installer Flow](02-Install-and-Update/Installer%20Flow.md): `install.ps1` → `install.gradle`, flags, backups, `.template` rules.
- [Power Tool Update Flow](02-Install-and-Update/Power%20Tool%20Update%20Flow.md): installing, updating and packaging Power Tool; what's preserved.
- [Subsystem Generator](02-Install-and-Update/Subsystem%20Generator.md): `generate-subsystem.ps1`, the JSON schema, markers.

## 03 PowerLib, `frc.powerlib` ([index](03-PowerLib/INDEX.md))
- [Shared Data Store](03-PowerLib/Shared%20Data%20Store.md): `PowerRobotContainer`, the map everything writes to.
- [Subsystems and IO](03-PowerLib/Subsystems%20and%20IO.md): Velocity/Position mechanisms, IO Real/Sim, ConfigurationQueue.
- [Mechanism Behavior](03-PowerLib/Mechanism%20Behavior.md): setpoints, profile acknowledgement, failures, readiness, cancellation.
- [Configs](03-PowerLib/Configs.md): config records and defaults.
- [State Machine and Controls](03-PowerLib/State%20Machine%20and%20Controls.md): `State`, owners and priority, `ButtonBindings`.
- [Autonomous](03-PowerLib/Autonomous.md): `Auto`, `AutoBuilder`, `NTChooser`.
- [Vision Pipeline](03-PowerLib/Vision%20Pipeline.md): multi-Limelight MT2 position and MT1 heading.
- [Tuning](03-PowerLib/Tuning.md): tunables, `@TunableConstant`, the tuning handshake.
- [Telemetry and Logging](03-PowerLib/Telemetry%20and%20Logging.md): **what gets logged and published.** Key for the log viewer.
- [Health, Math and Utils](03-PowerLib/Health,%20Math%20and%20Utils.md): `HealthChecks`, `LinearInterpolator`, `DriveUtil`.

## 04 Robot Templates
- [Robot Templates](04-Robot-Templates/Robot%20Templates.md): every starter `frc.robot` file and how they connect.

## 05 Power Tool ([index](05-Power-Tool/INDEX.md))
- [Power Tool Architecture](05-Power-Tool/Power%20Tool%20Architecture.md): Electron main, IPC, renderer, build.
- [NetworkTables Layer](05-Power-Tool/NetworkTables%20Layer.md): NT4 client, frame decoding, buffering, views.
- [Tabs and Features](05-Power-Tool/Tabs%20and%20Features.md): Drive, Robot, Subsystems, Limelights, NetworkTables; how to add a tab.
- [Custom Dashboard](05-Power-Tool/Custom%20Dashboard.md): the project-owned `power-tool/dashboard/`.

## 06 Data Flows ([index](06-Data-Flows/INDEX.md))
- [Telemetry Flow](06-Data-Flows/Telemetry%20Flow.md): shared map → SignalLogger (50 Hz) and NT frame (10 Hz) → Power Tool.
- [Tuning Round Trip](06-Data-Flows/Tuning%20Round%20Trip.md): live edit → robot → saved JSON → Java.
- [Code Generation Flow](06-Data-Flows/Code%20Generation%20Flow.md): Subsystems tab → JSON → generator → Java.
- [Vision to Pose Flow](06-Data-Flows/Vision%20to%20Pose%20Flow.md): cameras → filters → pose estimator.

## 07 Testing ([index](07-Testing/INDEX.md))
- [Tests and Checks](07-Testing/Tests%20and%20Checks.md): what each test covers and how to run them all.
- [Change to Tests Map](07-Testing/Change%20to%20Tests%20Map.md): which checks to run for the change you made.

## 08 Skills
- [powerlib-sim Skill](08-Skills/powerlib-sim%20Skill.md): the MapleSim setup skill.

## 09 Changelog ([index](09-Changelog/INDEX.md))
- [CHANGELOG](09-Changelog/CHANGELOG.md): every code change, newest first.

## 11 Ideas ([index](11-Ideas/INDEX.md))
- [Log Viewer Project](11-Ideas/Log%20Viewer%20Project.md): status and open questions for the log viewer.
- One note per idea we've talked about, each marked `proposed`, `decided` or `dropped`. See the [index](11-Ideas/INDEX.md).

## Meta
- [Maintaining This Vault](Maintaining%20This%20Vault.md): rules for keeping these notes in sync with the code.
