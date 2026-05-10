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

Before replacing a stock file, the installer creates a temporary backup. If the install succeeds, that backup is deleted during cleanup unless you pass `-PpowerlibKeepBackups=true`. If the install fails halfway through, the backup is left in place next to the original file.

When installing vendordeps, the installer first downloads the official latest JSONs for all five packages. By default, it then applies pinned overrides for any packages we know need pinning, currently MapleSim `0.4.0-beta`. Pass `-PpowerlibLatestVendordeps=true` to keep the latest vendordeps instead of applying pinned overrides. The installer saves each JSON using its `fileName`, and removes older vendordep JSONs with the same vendor `name` or `uuid`.

## Windows

From the root of the new robot project:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.gradle" -OutFile ".robot-library-install.gradle"
.\gradlew.bat -I .robot-library-install.gradle robotLibraryInstall
```

To keep replacement backups after a successful install, add this flag:

```powershell
.\gradlew.bat -I .robot-library-install.gradle robotLibraryInstall -PpowerlibKeepBackups=true
```

## macOS / Linux

From the root of the new robot project:

```bash
curl -fsSL "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.gradle" -o ".robot-library-install.gradle"
./gradlew -I .robot-library-install.gradle robotLibraryInstall
```

To keep replacement backups after a successful install, add this flag:

```bash
./gradlew -I .robot-library-install.gradle robotLibraryInstall -PpowerlibKeepBackups=true
```


## Latest Vendordeps

By default, the installer downloads latest vendordeps first, then applies pinned overrides for known fragile packages. To keep the latest vendordeps instead, add this flag:

```powershell
-PpowerlibLatestVendordeps=true
```

Example:

```powershell
.\gradlew.bat -I .robot-library-install.gradle robotLibraryInstall -PpowerlibLatestVendordeps=true
```
## Local Test

From the root of a test robot project, run the installer directly from a local checkout:

```powershell
.\gradlew.bat -I E:\code\projects\Robot-Library\install.gradle robotLibraryInstall
```

## After Install

The `.robot-library-install.gradle` file is only needed for the install run. The installer deletes it automatically after a successful run.

Future installer steps can live in `install.gradle`.

Files that should be added under `frc.powerlib` belong under:

```text
templates/powerlib/
```

Files that intentionally replace stock robot project files belong under:

```text
templates/replacements/
```










