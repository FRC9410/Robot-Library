---
title: powerlib-sim Skill
date: 2026-10-30
tags: [skills, simulation, maplesim, agents]
---

# powerlib-sim Skill

A coding-agent skill in `skills/` that sets up **MapleSim** physics simulation in a robot project.
Trigger phrases: "sim setup", "simulation", "maple sim", "SimManager", "set up sim".

## Files
| File | Purpose |
|---|---|
| `skills/SKILL.md` | The workflow (~730 lines). Collects robot physical values and game-piece definitions, then generates and edits files. Includes verified MapleSim 0.4.0-beta API facts and a DCMotor mapping table. |
| `skills/MapleSimSwerveDrivetrain-template.md` | Java template for the project-local wrapper. No vendordep class has this name, and you must not create a second CTRE sim drivetrain. |
| `skills/SimManager-template.md` | Game-piece spawning and `Pose3d[]` publishing |
| `skills/Swerve-sim-thread-template.md` | `Swerve.java` changes: sim thread, `simulationPeriodic`, `resetPose` override |

## What it generates in a robot project
- `gradle.properties`: pins the WPILib JDK 17.
- `src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java` and `SimManager.java`.
- Edits to `Swerve.java`, `Robot.java` and, if needed, `RobotContainer.java`.
- `sim-config.md`: a record of every value used.

Rules it follows:
- Never edit StateMachine, the IOSim classes or the constants.
- Raw NetworkTables only (no SmartDashboard), with sim topics under `/Simulation/...`.
- CTRE sim runs on the 5 ms notifier; the MapleSim arena runs in the 20 ms `simulationPeriodic()`.

## How it gets installed
- `install.gradle` copies these four files into the **robot project's root `skills/` folder**. Controlled by `-PpowerlibInstallSkills`, which defaults to the PowerLib choice.
- **Update Power Tool** also copies the whole `skills/` folder.
- It targets the pinned `maple-sim-0.4.0-beta` vendordep (see [Installer Flow](../02-Install-and-Update/Installer%20Flow.md)).

Related: [Robot Templates](../04-Robot-Templates/Robot%20Templates.md), [Subsystems and IO](../03-PowerLib/Subsystems%20and%20IO.md)
