# PowerLib starter project

1. Create a clean **WPILib 2026 Java Command Robot** project with your own project name and team number.
2. Extract this ZIP's **contents** into that project root, beside `build.gradle` and `gradlew.bat`. Merge folders and replace the stock `RobotContainer.java` and `.gitignore` when prompted. This archive is for a new project; use version control before applying it to an existing robot.
3. Double-click **Power Tool.cmd**. Power Tool is already built and includes Electron. Node, npm and an install script are not needed on this computer.
4. Open **File → Settings** to configure the robot. Use **File → Build Robot**, **Build and Deploy**, **Sim with DS**, or **Sim without DS**. Sim with DS assumes FRC Driver Station is already running.

The project keeps its original Gradle wrapper, `build.gradle`, WPILib preferences, team number, `Main.java` and `Robot.java`. WPILib and its Java tools are still required. The first robot build may download the vendor libraries referenced by the included dependency files.

The included `.gitignore` excludes all of `power-tool/app/`, including Electron, application archives and resources. Robot source, `vendordeps/` and auto definitions in `power-tool/generated/` can be committed normally. Each developer gets the prebuilt app by extracting the same ZIP. Local build output, logs and simulator settings are also ignored.

Save in Auto Builder writes Java explicitly. Rebuild/restart simulation or deploy after saving changes. Simulation console output is in `build/power-tool/simulation.log`.

This archive contains the generic starter configuration, not a configured competition robot. Set your drivetrain dimensions, CAN IDs and other hardware settings before deploying. Bundled vendor versions are recorded in `power-tool/release.txt`.
