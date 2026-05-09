# Robot-Library

One-time installer for Team 9410 robot project setup.

The installer is meant to be run from inside a newly-created WPILib Java robot project. It uses the robot project's Gradle wrapper, so Gradle does not need to be installed globally.

For now, the installer creates this folder:

```text
src/main/java/frc/powerlib
```

It also adds a `.gitkeep` file so the new folder can be committed before it contains Java files.

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

## After Install

The `.robot-library-install.gradle` file is only needed for the install run. The installer deletes it automatically after a successful run.

Future installer steps can live in `install.gradle`, and files that should be copied into robot projects can live under `templates/`.


