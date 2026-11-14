# Getting started

[Project README](../README.md) · [All guides](README.md)

Start here to add PowerLib and the prebuilt Power Tool to a new robot project. Review the [project requirements](../README.md#requirements) before continuing.

- [Download and extract](#download-and-extract)
- [Update Power Tool](#update-power-tool)
- [First configuration](#first-configuration)
- [First build and simulation](#first-build-and-simulation)
- [Vendor dependencies](#vendor-dependencies)
- [If something does not work](#if-something-does-not-work)

## Download and extract

Download the Windows project ZIP attached to a release from [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases). Choose the packaged project asset, rather than GitHub’s automatic source-code archives.

1. Create a clean **WPILib 2026 Java Command Robot** project with your team number.
2. Extract the **contents** of `Robot-Library-2026-Windows-x64.zip` into its root, beside `build.gradle`. Merge folders and replace the stock starter files and `.gitignore` when prompted.
3. Double-click **Power Tool.cmd**. Power Tool is prebuilt and runs without Node or npm.
4. Configure the robot through **File > Settings**, then build, simulate or deploy from File.

For characterization on Windows, open **Logs → Characterize Robot** and choose **Restart as administrator** if prompted. You can also start Power Tool with `"Power Tool.cmd" -Administrator` from Command Prompt. [Characterization setup](characterization.md#before-starting)

The ZIP contains PowerLib Java source, generic robot starter files, pinned vendor dependency JSONs, skills, and the standalone Windows x64 application in `power-tool/app/`. Its `.gitignore` excludes the entire prebuilt application while leaving robot source and auto authoring files available to commit. The project keeps its original Gradle files, WPILib preferences, team number, `Main.java` and `Robot.java`. The first robot build may download vendor libraries.

This is a starter overlay for a **clean project**. Extracting it replaces matching starter files directly. For an existing robot, review the release notes and preserve your project changes before applying files.

## Update Power Tool

Close Power Tool, then extract `Power-Tool-Windows-x64.zip` into the existing robot project root. Replace the bundled application and launcher files when prompted, then open **Power Tool.cmd**. This archive updates the desktop app. Apply any PowerLib Java updates separately before building or deploying the robot. [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases)

## First configuration

Open **File → Settings** in Power Tool. Review the following before running your robot:

| Area | What to review |
|---|---|
| Drivetrain Java | CAN buses and device IDs, module locations, gear ratios, encoder offsets and other drivetrain constants in `src/main/java/frc/robot/constants/` |
| Subsystems | Mechanism types, motors, sensors, controls and saved defaults |
| States | Names for your robot's behavior; implement the corresponding handlers in Java |
| Vision | Camera names and shared camera dimensions; configure mounting geometry and pipelines in each Limelight's own web UI |
| Field | Field layout, dimensions and bumper perimeter; bumper length and width default to 32 inches |
| Auto | Autonomous duration used by remaining-time branches |

The ZIP provides starter values. Match them to your robot. Some drivetrain settings require editing Java; the Settings UI does not expose every robot constant.

The original project's team number and Gradle setup remain in place. Power Tool's connection presets include Team 9410 addresses; use **File → Connection Settings** to select your own robot address or local simulation.

## First build and simulation

1. Save your robot settings. For an edited auto, click **Save** in its Steps card.
2. Run **File → Build Robot** to compile the current Java source.
3. Run **File → Sim without DS** to rebuild and launch the simulation GUI with its Driver Station controls. Use **Sim with DS** when the FRC Driver Station is already running.
4. Choose the local simulation connection in **File → Connection Settings** to view live data.
5. When ready to run on hardware, use **File → Build and Deploy** with the project's robot target configured.

The simulation actions use the robot project's simulation setup. The [simulation guide](simulation.md) explains the optional MapleSim setup skill. See [Power Tool](power-tool.md#build-deploy-and-simulate) for the File actions and save/build workflow.

## Vendor dependencies

The release ZIP includes these pinned vendor dependency files:

```text
vendordeps/ChoreoLib2026.json
vendordeps/PathplannerLib-2026.1.2.json
vendordeps/maple-sim-0.4.0-beta.json
vendordeps/Phoenix6-replay-26.3.0.json
vendordeps/Phoenix5-replay-5.36.0.json
```

The dependency JSON files are included in the archive. Gradle resolves their libraries when building; the tested snapshots live in [`templates/vendordeps/`](../templates/vendordeps/).

## If something does not work

| Symptom | First check |
|---|---|
| No `Power Tool.cmd` beside `build.gradle` | Extract the project ZIP's contents into the robot project root, rather than into another enclosing folder. |
| Power Tool does not start | Keep the entire `power-tool/app/` directory together, including `resources/app.asar`; extracting the executable alone is insufficient. |
| Build fails | Read the reported Gradle error and check the WPILib JDK, dependency access and robot constants. |
| Dashboard is disconnected | Review the host/port in Connection Settings and confirm the robot or simulation is running. |
| Simulation already running | Close its window before starting another simulation from Power Tool. |

For source layout and Java behavior, continue to [Java programming](java-programming.md).
