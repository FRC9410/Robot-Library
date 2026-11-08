# Simulation

[Project README](../README.md) · [All guides](README.md)

Use **File → Sim without DS** to rebuild and launch the simulation GUI, or **Sim with DS** when the FRC Driver Station is already running. Choose local simulation in Connection Settings to view live data.

Those actions run the simulation configured in your robot project. The optional skill below helps create MapleSim physics and game-piece integration for your robot.

- [Start simulation](#start-simulation)
- [Set up MapleSim with the project skill](#set-up-maplesim-with-the-project-skill)

## Start simulation

1. Save your settings and any edited auto.
2. Close the previous simulation window.
3. Select the appropriate simulation action from Power Tool's File menu; it rebuilds first.
4. Use the simulation GUI's Driver Station controls, or the already-running FRC Driver Station for the with-DS mode.

Simulation output is written to `build/power-tool/simulation.log`. Auto Builder's first drive point seeds its simulated starting pose; a real robot keeps its measured pose. See [Auto Builder](auto-builder.md) for save and runtime behavior.

## Set up MapleSim with the project skill

The release ZIP includes project-local agent skills in the root-level `skills/` directory so they travel with the robot project.

### Available skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| `powerlib-sim` | "sim setup", "simulation", "maple sim", "SimManager", "set up sim" | Guides you through entering robot physical values and game piece definitions, then generates all MapleSim integration files from scratch |

### What the skill generates

| File | Action |
|------|--------|
| `gradle.properties` | Created — pins Gradle to WPILib JDK 17 |
| `src/.../simulation/MapleSimSwerveDrivetrain.java` | Created — MapleSim physics wrapper |
| `src/.../simulation/SimManager.java` | Created — game piece spawning and pose publishing |
| `src/.../subsystems/Swerve.java` | Modified — sim thread and pose publisher |
| `src/.../Robot.java` | Modified — `simulationPeriodic()`, `resetField()`, `publishPoses()` |
| `sim-config.md` | Created — reference doc with all values used |

The `powerlib-sim` skill is available in any robot project set up with Robot-Library. It walks you through setting up MapleSim simulation from scratch — something that normally requires reading through vendordep APIs, writing physics config boilerplate, and wiring up several files by hand.

The skill collects your robot's physical properties (weight, bumper size, motor types, wheel COF) and your season's game piece definitions (shape, mass, damping, spawn locations), then generates and modifies all the required files so simulation works out of the box with `./gradlew simulateJava`.

To use it, open your coding agent in your robot project and say something like:

```
set up sim for this robot
```

The skill will take it from there.

---

Related: [Power Tool File actions](power-tool.md#build-deploy-and-simulate) and [Java autonomous commands](java-programming.md#autonomous-chooser).
