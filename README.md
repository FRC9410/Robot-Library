# Robot-Library

One-time installer for Team 9410 robot project setup.

The installer is meant to be run from inside a newly-created WPILib Java robot project. It uses the robot project's Gradle wrapper, so Gradle does not need to be installed globally.

## What It Installs

PowerLib files:

```text
src/main/java/frc/powerlib/PowerRobotContainer.java
```

Replacement starter files:

```text
src/main/java/frc/robot/RobotContainer.java
```

Before replacing a stock file, the installer creates a temporary backup. If the install succeeds, that backup is deleted during cleanup unless you pass `-PpowerlibKeepBackups=true`. If the install fails halfway through, the backup is left in place next to the original file.

## Windows

From the root of the new robot project:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.gradle" -OutFile ".robot-library-install.gradle"
.\gradlew.bat -I .robot-library-install.gradle robotLibraryInstall
```

## macOS / Linux

From the root of the new robot project:

```bash
curl -fsSL "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.gradle" -o ".robot-library-install.gradle"
./gradlew -I .robot-library-install.gradle robotLibraryInstall
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



