# Robot-Library

Team 9410 one-time installer for starting a new WPILib Java robot project.

Run the installer from the root of a newly-created robot project. It uses that project's Gradle wrapper, so Gradle does not need to be installed globally.

## Install

Windows:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.ps1" -OutFile ".robot-library-install.ps1"
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1
```

macOS / Linux:

```bash
curl -fsSL "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.ps1" -o ".robot-library-install.ps1"
pwsh -ExecutionPolicy Bypass -File ./.robot-library-install.ps1
```

The installer asks which sections to install:

```text
PowerLib library files
robot starter/template files
vendor dependencies
Power Tool source, npm dependencies, and scripts
```

## Added Library Files

PowerLib files are added under `frc.powerlib`:

```text
src/main/java/frc/powerlib/PowerRobotContainer.java
src/main/java/frc/powerlib/configs/*.java
src/main/java/frc/powerlib/math/*.java
src/main/java/frc/powerlib/subsystems/*.java
src/main/java/frc/powerlib/utils/*.java
```

## Added / Replaced Robot Files

These robot starter/template files are written into the robot project. On the first install, existing stock files are backed up before replacement. On later installs, existing robot template files are preserved and the updated template is written beside them with a `Template` suffix, such as `RobotContainerTemplate.java`.

```text
src/main/java/frc/robot/Constants.java
src/main/java/frc/robot/RobotContainer.java
src/main/java/frc/robot/commands/SwerveDriveCommand.java
src/main/java/frc/robot/constants/CanBusConstants.java
src/main/java/frc/robot/constants/LEDConstants.java
src/main/java/frc/robot/constants/LocationConstants.java
src/main/java/frc/robot/constants/OIConstants.java
src/main/java/frc/robot/constants/TunerConstants.java
src/main/java/frc/robot/constants/VisionConstants.java
src/main/java/frc/robot/subsystems/LED.java
src/main/java/frc/robot/subsystems/StateMachine.java
src/main/java/frc/robot/subsystems/Swerve.java
src/main/java/frc/robot/subsystems/Vision.java
src/main/java/frc/robot/utils/FieldUtils.java
```

The installer creates temporary backups before replacing files. Successful installs delete those backups by default.

## Vendor Dependencies

The installer can add these vendordeps:

```text
vendordeps/ChoreoLib2026.json
vendordeps/PathplannerLib-<latest>.json
vendordeps/maple-sim-0.4.0-beta.json
vendordeps/Phoenix6-replay-<latest>.json
vendordeps/Phoenix5-replay-<latest>.json
```

## Power Tool

Power Tool is installed into the robot project as source:

```text
power-tool/
power-tool.cmd
power-tool/scripts/power-tool.ps1
power-tool/scripts/update-power-tool.ps1
power-tool/scripts/generate-subsystem.ps1
power-tool/scripts/powerlib-generate-subsystem.cmd
power-tool/scripts/powerlib-update-subsystems.cmd
```

Open it on Windows from the robot project root:

```powershell
.\power-tool.cmd
```

Or run the PowerShell launcher directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\power-tool\scripts\power-tool.ps1
```

Power Tool includes NetworkTables tools and generated subsystem editing. Install builds the app once, then the launchers run the built Electron app with `npm start`. Its `node_modules` folder is created during install and should not be committed.

Use `Update Power Tool` inside the app to download the latest Power Tool source, refresh the scripts, reinstall npm dependencies, and restart the app.

## Internal Docs

Maintainer notes and development workflow details live in [INTERNAL.md](INTERNAL.md).
