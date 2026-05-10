# Robot-Library

One-time installer for Team 9410 robot project setup.

The installer is meant to be run from inside a newly-created WPILib Java robot project. It uses the robot project's Gradle wrapper, so Gradle does not need to be installed globally.

## What It Installs

PowerLib files:

```text
src/main/java/frc/powerlib/PowerRobotContainer.java
src/main/java/frc/powerlib/configs/*.java
src/main/java/frc/powerlib/math/*.java
src/main/java/frc/powerlib/subsystems/*.java
src/main/java/frc/powerlib/utils/*.java
```

Replacement starter files:

```text
src/main/java/frc/robot/RobotContainer.java
src/main/java/frc/robot/subsystems/StateMachine.java
src/main/java/frc/robot/subsystems/LED.java
```

Vendor dependencies:

```text
vendordeps/ChoreoLib2026.json
vendordeps/PathplannerLib-<latest>.json
vendordeps/maple-sim-0.4.0-beta.json
vendordeps/Phoenix6-replay-<latest>.json
vendordeps/Phoenix5-replay-<latest>.json
```

Power Tool:

```text
power-tool/
power-tool.cmd
power-tool/scripts/power-tool.ps1
power-tool/scripts/generate-subsystem.ps1
power-tool/scripts/powerlib-generate-subsystem.cmd
power-tool/scripts/powerlib-update-subsystems.cmd
```

Before replacing a stock file, the installer creates a temporary backup. If the install succeeds, that backup is deleted during cleanup unless you pass `-PpowerlibKeepBackups=true`. If the install fails halfway through, the backup is left in place next to the original file.

When installing vendordeps, the installer first downloads the official latest JSONs for all five packages. By default, it then applies pinned overrides for any packages we know need pinning, currently MapleSim `0.4.0-beta`. Pass `-PpowerlibLatestVendordeps=true` to keep the latest vendordeps instead of applying pinned overrides. The installer saves each JSON using its `fileName`, and removes older vendordep JSONs with the same vendor `name` or `uuid`.

## Windows

From the root of the new robot project:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.ps1" -OutFile ".robot-library-install.ps1"
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1
```

To keep replacement backups after a successful install, add this flag:

```powershell
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1 -PpowerlibKeepBackups=true
```

To update only part of an installed project, turn off the sections you do not want. By default, all sections are installed.

```powershell
# Update helper scripts and vendordeps, but leave Java library/starter files alone.
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1 -PpowerlibInstallLib=false

# Update Java library/starter files and helper scripts, but leave vendordeps alone.
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1 -PpowerlibInstallVendordeps=false

# Update only vendordeps.
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1 -PpowerlibInstallLib=false -PpowerlibInstallScripts=false
```

When run from an interactive terminal, the installer asks at the beginning whether to install each section, including Power Tool.

The downloaded `.robot-library-install.ps1` deletes itself after the run. Add `-KeepInstaller` if you want to reuse it for repeated update tests.

## macOS / Linux

From the root of the new robot project:

```bash
curl -fsSL "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.ps1" -o ".robot-library-install.ps1"
pwsh -ExecutionPolicy Bypass -File ./.robot-library-install.ps1
```

To keep replacement backups after a successful install, add this flag:

```bash
pwsh -ExecutionPolicy Bypass -File ./.robot-library-install.ps1 -PpowerlibKeepBackups=true
```

To update only part of an installed project, turn off the sections you do not want. By default, all sections are installed.

```bash
# Update helper scripts and vendordeps, but leave Java library/starter files alone.
pwsh -ExecutionPolicy Bypass -File ./.robot-library-install.ps1 -PpowerlibInstallLib=false

# Update Java library/starter files and helper scripts, but leave vendordeps alone.
pwsh -ExecutionPolicy Bypass -File ./.robot-library-install.ps1 -PpowerlibInstallVendordeps=false

# Update only vendordeps.
pwsh -ExecutionPolicy Bypass -File ./.robot-library-install.ps1 -PpowerlibInstallLib=false -PpowerlibInstallScripts=false
```

When run from an interactive terminal, the installer asks at the beginning whether to install each section, including Power Tool.

## Install Sections

These flags control which sections the installer updates. They all default to `true`.

```text
-PpowerlibInstallLib=true
-PpowerlibInstallScripts=true
-PpowerlibInstallVendordeps=true
-PpowerlibInstallTools=true
-PpowerlibInstallDashboard=true
-PpowerlibInteractive=true
```

At the beginning of an interactive install, the installer asks whether to install:

```text
PowerLib Java/starter files
helper scripts
vendor dependencies
Power Tool source and npm dependencies
```

The Power Tool option downloads the app source, runs `npm install`, and writes the run scripts.

Set `-PpowerlibInteractive=false` to skip prompts and use the flag/default values directly.

To skip Power Tool during install or update:

```powershell
-PpowerlibInstallTools=false
```

To install tools but skip the Power Tool download/npm install:

```powershell
-PpowerlibInstallDashboard=false
```

To start Power Tool after it is installed:

```powershell
.\power-tool.cmd
```

Or:

```powershell
powershell -ExecutionPolicy Bypass -File .\power-tool\scripts\power-tool.ps1
```

The Power Tool source stays in the robot project so it can be run or edited locally. Its `node_modules` folder is created by `npm install` and should not be committed.

To build the dashboard locally from this library repo:

```powershell
cd E:\code\projects\Robot-Library
.\build-dashboard.ps1
```

To make a compiled dashboard app locally:

```powershell
.\build-dashboard.ps1 -Publish
```

To target another platform explicitly:

```powershell
.\build-dashboard.ps1 -Platform win
.\build-dashboard.ps1 -Platform mac
.\build-dashboard.ps1 -Platform linux
```

Compiled app output is ignored by Git and is not used by the GitHub installer.


## Latest Vendordeps

By default, the installer downloads latest vendordeps first, then applies pinned overrides for known fragile packages. To keep the latest vendordeps instead, add this flag:

```powershell
-PpowerlibLatestVendordeps=true
```

Example:

```powershell
powershell -ExecutionPolicy Bypass -File .\.robot-library-install.ps1 -PpowerlibLatestVendordeps=true
```
## Local Test

From the root of a test robot project, run the installer directly from a local checkout:

```powershell
powershell -ExecutionPolicy Bypass -File E:\code\projects\Robot-Library\install.ps1
```



## Generate Subsystems

After running the installer, you can generate subsystem configs and initialize predefined PowerLib subsystem types in `StateMachine`. The installer downloads the generator into `power-tool/scripts` and creates short Windows command wrappers there.

Windows:

```powershell
.\power-tool\scripts\powerlib-generate-subsystem.cmd
```

If `powerlib-subsystems.json` already exists, the command first asks whether to update the generated code from that JSON. Answer no to add subsystems interactively instead.

To skip the build check after generation:

```powershell
.\power-tool\scripts\powerlib-generate-subsystem.cmd -SkipBuild
```

Local test from a robot project:

```powershell
powershell -ExecutionPolicy Bypass -File E:\code\projects\Robot-Library\generate-subsystem.ps1
```

The generator script stays in the robot project so you can run it again later. The generator currently supports `velocity` and `position` subsystem types. It creates a constants file, adds the constants barrel entry in `Constants.java`, and inserts the initialized subsystem between the `POWERLIB GENERATED SUBSYSTEMS` markers in `StateMachine.java`.

By default, generation runs the robot project's `build` task after the prompts finish. Add `-SkipBuild` to skip the build check.

The generator also maintains `powerlib-subsystems.json` in the robot project. Interactive generation adds or updates subsystem entries in that JSON document, then rewrites the generated Java files from the document. After each subsystem, the script asks whether to add another.

Enum prompts show the accepted values in the prompt. For example:

```text
Subsystem type (accepted: velocity, position) [velocity]
Leader neutral mode (accepted: Brake, Coast) [Brake]
```

By default, interactive generation skips PID/feedforward tuning and writes zero PID values with empty feedforward optionals. Answer yes to `Configure PID/feedforward values?` when you want to enter `kP`, `kI`, `kD`, `kG`, `kS`, `kV`, and `kA`.

You can edit `powerlib-subsystems.json` directly, then run the generator and answer yes when it asks to update from JSON:

```powershell
.\power-tool\scripts\powerlib-generate-subsystem.cmd
```

To reconcile without running the build check:

```powershell
.\power-tool\scripts\powerlib-generate-subsystem.cmd -SkipBuild
```

The update flow changes generated constants, adds new subsystems, removes generated subsystem constants that are no longer in the JSON, and rewrites the generated block in `StateMachine.java`.

Generated subsystem constants files include a protected custom block:

```java
  // POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE
  // POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE
```

Add hand-written constants between those markers. Updates preserve that block while regenerating the subsystem config from `powerlib-subsystems.json`.

Each JSON subsystem has a stable `id`. To rename a subsystem, change its `name` but keep its `id` the same. The update flow uses that id to carry custom constants from the old generated constants file to the renamed one.
## Build Check

By default, the installer runs the robot project's `build` task after installing files and vendordeps. To skip that build check, add this flag:

```powershell
-PpowerlibSkipBuild=true
```
## After Install

The `.robot-library-install.ps1` and `.robot-library-install.gradle` files are only needed for the install run. The installer deletes them automatically unless you pass `-KeepInstaller`.

Future installer steps can live in `install.gradle`.

Files that should be added under `frc.powerlib` belong under:

```text
templates/powerlib/
```

Files that intentionally replace stock robot project files belong under:

```text
templates/replacements/
```


















