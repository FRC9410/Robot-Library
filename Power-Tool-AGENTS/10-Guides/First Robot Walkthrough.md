---
title: First Robot Walkthrough
date: 2026-10-30
tags: [guide, walkthrough]
---

# First Robot Walkthrough

One mechanism, an intake roller, from an empty WPILib project to a tuned value saved in Java.
Each step lists the files you should see and what Power Tool should show.

## 1. Install
In a new WPILib 2026 Java command-based project root:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.ps1" -OutFile ".robot-library-install.ps1"
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1
```
Answer yes to PowerLib, vendordeps and Power Tool.

**Expect:**
- `src/main/java/frc/powerlib/**`
- `src/main/java/frc/robot/{RobotContainer, Constants}.java`, `subsystems/{StateMachine, Swerve, Vision, PowerDashboard}.java`, `constants/*`
- `vendordeps/*.json`, `skills/`
- `power-tool/` (with `scripts/power-tool.cmd`)
- `.powerlib-installed`
- the closing `gradlew build` passes

Replace `constants/TunerConstants.java` with your own CTRE Tuner X swerve output. Keep
`createDrivetrain()` returning `new Swerve(...)`.
Details: [Installer Flow](../02-Install-and-Update/Installer%20Flow.md).

## 2. Configure the mechanism in Power Tool
Run `.\power-tool\scripts\power-tool.cmd`. On the **Subsystems** tab, click Create:
- Name `IntakeRoller`, type `velocity`.
- Leader motor CAN ID 20, Brake.
- Leave gains at 0 for now; you tune them later.

Click Save. **Expect:** `power-tool/generated/powerlib-subsystems.json` gets an entry with
`"id": "intakeRoller"`. **No Java changes yet.**
JSON reference: [Configuration Examples](Configuration%20Examples.md).

## 3. Generate Java
Run **File → Update Code**. The toast should report generated files and `BUILD SUCCESSFUL`.

**Expect:**
- `constants/IntakeRollerConstants.java` with `INTAKE_ROLLER_CONFIG` and an empty custom-constants block. From now on that block is rebuilt from `powerlib-constants.json`, so add custom constants there ([File Ownership and Precedence](File%20Ownership%20and%20Precedence.md)).
- An alias in `Constants.java`: `Constants.IntakeRoller`.
- A field in `StateMachine.java`, between the generated markers:
  `public final VelocitySubsystem intakeRoller = new VelocitySubsystem(Constants.IntakeRoller.INTAKE_ROLLER_CONFIG);`
- `characterization/IntakeRollerCharacterization.java` (SysId), registered in `PowerDashboard`.
- `constants/GeneratedTunableConstants.java` refreshed.

Details: [Code Generation Flow](../06-Data-Flows/Code%20Generation%20Flow.md).

## 4. Use it from a state
Add `INTAKING` to `RobotState`, then write and register a handler that calls
`stateMachine.intakeRoller.setVelocity(...)`. Bind a button with `ButtonBindings.bindStates`.
Full example: [Adding a Robot State](Adding%20a%20Robot%20State.md).

## 5. Deploy
Deploy with WPILib (*Deploy Robot Code*). In Power Tool, connect to `10.94.10.2` or
`roborio-9410-frc.local` (or `localhost` for sim).

**Expect:**
- **Drive tab:** live heartbeat, battery and state. An `IntakeRoller` mechanism card shows Velocity and setpoint (rps).
- **Robot tab:** an `IntakeRoller` card with live `Velocity`/`VelocitySetpoint`, plus its tunables (`PID/kP`, `Feedforward/kV`, `MotionMagic/Acceleration`, `Motors/20/BrakeMode`…).
- **On the robot:** PowerLib *sends* `PowerLib/Subsystems/IntakeRoller/Data/Velocity` to SignalLogger at 50 Hz. It's **recorded only while SignalLogger is running**. The templates never call `SignalLogger.start()`, so Phoenix's defaults decide: auto-start when an FMS match is detected. At practice, with no FMS, **expect no `.hoot` file** unless you start the logger yourself, e.g. `SignalLogger.start()` in `Robot.robotInit()`.

  **To confirm recording during practice:**
  1. Enable the robot for a minute, then disable it.
  2. List the logs with Phoenix Tuner X's log tools, or look in the roboRIO log folder: USB drive if present, otherwise `/home/lvuser/logs`.
  3. Check that a new `.hoot` file with the current time exists and contains `PowerLib/Subsystems/...` signals.

  Details: [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md).

See [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md).

## 6. Tune live
1. Turn on the header **Tuning** switch and wait until it stops saying "syncing" (the robot acknowledged).
2. Open the `IntakeRoller` card, edit `Feedforward/kV` and `PID/kP`, and click Apply.
3. Hold the intake button and watch Velocity track VelocitySetpoint.

Changes go through the config queue, so allow a moment before judging. See
[Tuning Round Trip](../06-Data-Flows/Tuning%20Round%20Trip.md).

## 7. Keep the tuned values
1. In the drawer, click **Save Tuned Values**, select the changed gains, and save. This writes `powerlib-subsystems.json`.
2. Run **File → Update Code**. `IntakeRollerConstants.java` now has the new `KP`/`KV`.
3. Commit, rebuild and deploy. Restarting the robot now loads the tuned values.

## If a step fails
See [Troubleshooting](Troubleshooting.md).

Related: [File Ownership and Precedence](File%20Ownership%20and%20Precedence.md), [Robot Lifecycle](Robot%20Lifecycle.md), [Mechanism Behavior](../03-PowerLib/Mechanism%20Behavior.md), [Architecture](../01-Overview/Architecture.md)
