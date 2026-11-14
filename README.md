# Robot-Library

## What is Power Tool and Robot Library?

Every year, we found ourselves writing the same boilerplate for a new FRC robot: setting up motors and sensors, organizing subsystem behavior, connecting a dashboard, and getting autonomous routines and logging working. The robot changed, but much of the setup stayed the same. We wanted to carry that work forward so we could spend more time on what made the new robot different.

**Robot Library** grew out of that repeated work. It brings our reusable Java code, called **PowerLib**, together with starter files for a WPILib robot project. It provides a foundation for mechanisms, robot states, autonomous commands, telemetry and vision, while leaving each team to build the behavior its robot needs.

**Power Tool** is the desktop companion to that library. It puts configuration, live robot data, tuning, autonomous editing, log viewing and subsystem characterization in one place.

Our goal is to make the familiar work easier each season and give teams more time to understand, test and improve their robot.

## What Power Tool provides and what your team owns

| Area | Power Tool provides | Your team owns |
|---|---|---|
| Robot setup | Forms that generate and maintain supported Java code, including mechanism classes, constants, state-handler scaffolding and registrations | Hardware setup, Tuner X drivetrain configuration, and each Limelight's mounting pose, calibration and pipelines |
| Robot behavior | Auto Builder generates Java commands from the routines you design | Driver bindings, state-handler logic, custom commands and match strategy |
| Testing and tuning | Live telemetry, log playback, tuning controls and SysId characterization | Choosing and validating gains, testing on the actual robot, and deciding when the robot is ready to run |
| Build and run | Menu actions for the project's Gradle build, deployment and simulation | WPILib project setup, robot deployment targets and FRC Driver Station operation |

## An opinionated ecosystem

**Robot Library and Power Tool are intentionally very opinionated.** They reflect how our team builds robots: WPILib Java, CTRE Phoenix motor control and Tuner X swerve, Limelight vision, and PowerLib's state-machine approach to coordinating mechanisms. Power Tool also expects the project's Java structure, configuration conventions and telemetry format.

**Use Power Tool as the main way to configure the robot.** The Java source remains available for custom behavior and extensions, but configuring the robot directly in code or changing the generated structure can lead to unexpected Power Tool behavior. Settings may become unrecognized or read-only when the code no longer follows the conventions Power Tool understands. Preserve that structure when adding your own code.

Using the project means adopting those conventions. Teams using other hardware, drivetrain frameworks, vision systems or software architectures should expect to adapt the code and integrations. The [getting-started guide](docs/getting-started.md) explains the setup and configuration to review before running your robot.

## Requirements

The intended setup for this project requires:

- **Windows x64** for the prebuilt Power Tool application.
- **WPILib 2026** and a **Java Command Robot** project.
- **CTRE Phoenix 6 hardware and Tuner X**, including the Talon FX, CANcoder and Pigeon 2 swerve setup used by the starter.
- **A CTRE CANivore**, configured to match the project's CAN bus settings.
- **[CTRE Phoenix Pro licensing](https://v6.docs.ctr-electronics.com/en/stable/docs/licensing/what-is-licensing.html)** covering the devices that use Pro features.
- **Limelight cameras** for the included AprilTag position and heading integration.

Power Tool includes its runtime; users do not need Node or npm. WPILib and its Java tools are still required to build the robot. See [Getting started](docs/getting-started.md#first-configuration) for the configuration checklist.

## Documentation

Download `Robot-Library-2026-Windows-x64.zip` for a new robot project or `Power-Tool-Windows-x64.zip` to update the desktop app in an existing project. [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases)

| Guide | What you will find |
|---|---|
| [Getting started](docs/getting-started.md) | Extraction, first configuration and first build |
| [Power Tool](docs/power-tool.md) | Connections, Dashboard, Settings, tuning, build and deployment |
| [Auto Builder](docs/auto-builder.md) | Editing routines, saving, state steps and robot check branches |
| [Log Viewer](docs/log-viewer.md) | Opening, downloading and reviewing recorded runs |
| [Characterization](docs/characterization.md) | SysId for velocity, drivetrain and position mechanisms |
| [Java programming](docs/java-programming.md) | Project structure, autonomous APIs, state handlers and telemetry |
| [Vision](docs/vision.md) | Limelight setup, pose fusion and detailed heading policies |
| [Simulation](docs/simulation.md) | Simulation launch modes and the MapleSim setup skill |
| [Integrations](docs/integrations.md) | Optional WPILib NetworkTables and MCP tools |
