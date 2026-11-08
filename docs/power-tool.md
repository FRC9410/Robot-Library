# Power Tool

[Project README](../README.md) · [All guides](README.md)

Power Tool is the desktop app for your robot's live dashboard, configuration, autonomous editor and recorded logs. Open **Power Tool.cmd** from the robot project root.

- [Connect to a robot or simulation](#connect-to-a-robot-or-simulation)
- [Choose a workspace](#choose-a-workspace)
- [Settings](#settings)
- [Field and display settings](#field-and-display-settings)
- [Build, deploy and simulate](#build-deploy-and-simulate)
- [Live tuning and saved defaults](#live-tuning-and-saved-defaults)
- [Settings and Java source](#settings-and-java-source)
- [Application files](#application-files)

## Connect to a robot or simulation

Open **File → Connection Settings** to choose a target. Local simulation uses `localhost` or `127.0.0.1` on port `5810`. Robot presets include Team 9410 addresses; choose the host appropriate to your own team and network. The connection controls show the active endpoint and status.

## Choose a workspace

| Tab | Use it for |
|---|---|
| Dashboard | Live robot pose, discovered cameras, mechanism telemetry and autonomous selection |
| Autos | Creating and saving autonomous routines; see [Auto Builder](auto-builder.md) |
| Logs | Opening and reviewing recorded runs; see [Log Viewer](log-viewer.md) |

Dashboard's live pose needs a robot connection. You can edit autos and review recorded log poses while disconnected.

## Settings

**File → Settings** opens from any tab:

| Category | Purpose |
|---|---|
| Subsystems | Create and edit mechanisms, motors, sensors and controls |
| States | Manage state names and handlers |
| Vision | Set Limelight names and shared camera dimensions |
| Field | Choose a field image/layout, upload a field and set bumper dimensions |
| Auto | Set autonomous duration for remaining-time branches |

Implement state behavior and robot-specific driver bindings in Java. See [Java programming](java-programming.md#robot-states) and [Vision](vision.md).

## Field and display settings

Dashboard, Auto Builder and Logs share the selected field layout and blue-origin coordinates. Choose a built-in field, upload a PNG/JPEG/WebP field image, or use custom dimensions. Bumper length and width default to **32 × 32 inches**.

Field layout, display orientation and bumper dimensions are local display preferences. They do not rewrite robot Java or change saved point/log coordinates. See the [field layout reference](../powerlib-dashboard/README.md#shared-field-layouts) for details.

## Build, deploy and simulate

| File action | Result |
|---|---|
| Build Robot | Compiles the current robot Java source |
| Build and Deploy | Builds first, then deploys using the project's Gradle target |
| Sim with DS | Rebuilds and launches the simulation GUI with a connection to the already-running FRC Driver Station |
| Sim without DS | Rebuilds and launches the simulation GUI with its built-in Driver Station controls |

Saving, building and running are separate steps. Save the edited settings or auto, then rebuild and restart simulation or deploy to run the changes. Building alone does not generate an auto from an unsaved editor draft. Close an existing simulation before launching another. Simulation console output is in `build/power-tool/simulation.log`.

See [Getting started](getting-started.md#first-build-and-simulation) for the first run and [Simulation](simulation.md) for the MapleSim setup skill.

## Saving configuration

Define controller button commands directly in `RobotContainer.configureBindings()`.
Power Tool saves configuration directly into robot Java source. File > Settings saves patch the affected declarations and registrations immediately; File > Build Robot compiles the current source. There is no JSON-to-code generation step.

## Live tuning and saved defaults

Dashboard mechanism cards open their tunables when Tuning is enabled and acknowledged. Apply changes the running robot through NetworkTables. Save Tuned Values reviews live differences and writes selected mechanism, sensor, drivetrain, localization and custom defaults together in one Java transaction. Rebuild and deploy to use saved defaults at startup.

Velocity and velocity-torque mechanisms support an optional positive, finite stator current limit. A blank value preserves Phoenix defaults. Signed feedback ratios and optional feedforward/default-position values remain supported. Source edits preserve existing annotations, modifiers, comments, custom methods and handler bodies. Unsupported expressions are read-only and require editing in Java. If source changes while a form is open, refresh before saving; the draft is retained.

## Settings and Java source

File > Settings manages subsystem structure, state names and camera configuration. Stable subsystem IDs live in Java comments; changing the display name preserves the source class. Idle is implicit, hidden from the state list and always last in the enum and handler registry. Existing state bodies and handler priority are preserved. Confirmed deletion removes the state immediately, including edited Java, unless other source still references it. Manual Java additions appear when configuration refreshes.

### Constants and tuning recovery

Constants groups are discovered from the robot constants directory, including team-specific classes. Custom numeric constants are registered under `/PowerLib/Subsystems/<Name>/Variables/Custom/<ConstantName>`. Existing fields retain their tuning annotations; newly added numeric custom constants become tunable. GeneratedTunableConstants and TunerConstants are excluded from the constants editor.

Temporary live tuning recovery is separate from code defaults. Successfully applied tunables are cached as JSON under Power Tool's app-local user-data directory, isolated by project, connection profile, host and port. After restarting the app, Restore edits places matching values into pending drafts. It never publishes automatically; review and Apply to send them. Restarting the robot loads the saved Java defaults. Turning tuning off keeps the last live values but stops further tuning synchronization.

Old `powerlib-subsystems.json` and `powerlib-constants.json` files are read only by migration review. Choose saved differences to import, or keep Java values. Migration backs up source and legacy files under `build/power-tool-migration/` before archiving the old active files. Malformed JSON or a stale review is rejected. 

Tunable fields are mutable rather than Java compile-time constants, so robot code
must read them during execution to use live edits. Values copied only during
initialization, such as a controller port, still require a restart to change the
initialized object. Numeric types include byte, short, int, long, float, double,
and their boxed equivalents; integer edits must fit the type's whole-number range.

The robot templates include `StateMachineConstants` for the default robot state and
`OIConstants` for the driver controller port, accessible through
`Constants.StateMachine` and `Constants.OI`. `RobotContainerConstants` holds custom
constants for robot container setup.

## Application files

The release ZIP includes the prebuilt application and its launcher:

```text
Power Tool.cmd
power-tool/app/Power Tool.exe
power-tool/app/resources/
power-tool/release.txt
```

Double-click **Power Tool.cmd** in the robot project root. The application includes
its Electron runtime and provides NetworkTables tools, robot settings, autonomous
editing, and log viewing. Its bundled application files are excluded from Git by
`/power-tool/app/`; robot source and auto definitions remain available to commit.

Power Tool opens on a generic **Dashboard** view with discovered camera streams, a field view, an autonomous dropdown, and optional drivetrain and robot telemetry. The starter robot collects feedback through `DriveTelemetry` at the normal robot loop rate and publishes it every 100 ms. Power Tool requests and batches telemetry at the same 100 ms cadence. See [Dashboard setup](../powerlib-dashboard/DASHBOARD.md) for existing-project integration, camera discovery, and topic mappings.

Get new versions from [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases). Review the release notes before updating an existing robot project.

The [dashboard integration reference](../powerlib-dashboard/DASHBOARD.md) describes camera discovery and topic mappings. Source customization and packaging are covered in [Development](development.md).
