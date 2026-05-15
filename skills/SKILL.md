---
name: powerlib-sim
description: >
  Use this skill whenever a Team 9410 PowerLib robot project needs MapleSim simulation set up,
  configured, or regenerated from scratch. Triggers on any mention of "sim setup", "simulation",
  "maple sim", "SimManager", "game pieces in sim", or "set up sim" in the context of the Robot-Library
  / PowerLib codebase. This skill guides the user through collecting all required physical robot values
  and game piece definitions, then generates MapleSimSwerveDrivetrain.java, SimManager.java, updates
  Swerve.java, StateMachine.java, and Robot.java, and writes a sim-config.md reference doc. Use this
  skill even if the user only mentions wanting to run simulation or test autonomous in sim.
---

# PowerLib Sim Setup Skill

This skill collects robot physical properties and game piece definitions from the user, then generates
all MapleSim integration files for a Team 9410 PowerLib robot project.

## What Gets Generated / Modified

| File | Action |
|------|--------|
| `src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java` | Created — copied from CTRE-Swerve-MapleSim template, initial pose fixed |
| `src/main/java/frc/robot/utils/simulation/SimManager.java` | Created — correct GamePieceInfo API, NT publishing, no dead update() |
| `src/main/java/frc/robot/subsystems/Swerve.java` | Modified — fixed imports, updated startSimThread(), added sim pose publisher |
| `src/main/java/frc/robot/subsystems/StateMachine.java` | Modified — added pre-construction module constant regulation |
| `src/main/java/frc/robot/Robot.java` | Modified — added resetField() and publishPoses() calls |
| `sim-config.md` | Created — reference doc |

## What Does NOT Change

- `VelocitySubsystemIOSim`, `PositionSubsystemIOSim`, `AbsolutePositionSubsystemIOSim`
- All other PowerLib library files
- `RobotContainer.java`, constants files

---

## Step 1: Collect Robot Physical Properties

Ask the user for each value below as a numbered list. Wait for all answers before proceeding.
If unsure about a value, provide the default shown and explain where to find the real number.

```
1. Robot weight in pounds (typical FRC robot: 100–130 lbs)
2. Bumper length in inches (outside edge to outside edge, front-to-back)
3. Bumper width in inches (outside edge to outside edge, side-to-side)
4. Wheel coefficient of friction / COF (default: 1.2 for Colsons, 1.5 for grippy treads)
5. Drive motor type:
      a) Kraken X60 (default for PowerLib)
      b) Kraken X60 FOC
      c) Kraken X44
      d) Falcon 500
      e) NEO
6. Steer motor type:
      a) Kraken X44 (default for PowerLib)
      b) Kraken X60
      c) Falcon 500
      d) NEO 550
      e) NEO
```

Values pulled automatically from existing code — do NOT ask the user for these:
- `kSimLoopPeriod = 0.005` (already in Swerve.java)
- Module locations: `TunerConstants.FrontLeft/FrontRight/BackLeft/BackRight`
- Pigeon2: `getPigeon2()`
- Modules: `getModules()`

---

## Step 2: Collect Game Piece Definitions

Tell the user:

> "Now let's define the game pieces for this season's field. You can add as many types as needed.
> Enter 'done' when finished."

For each game piece, ask:

```
1. Name (e.g. "Note", "Coral", "Ball") — used as the Java constant name
2. Shape:
      a) Cylinder (for rings, balls, pucks)
      b) Box (for cubes, crates)
3. Mass in kg (typical game piece: 0.1–0.5 kg)
4. If cylinder: radius in inches
   If box: length in inches, width in inches
5. Height in inches
6. Linear damping (default: 0.8)
7. Angular damping (default: 0.8)
8. Coefficient of restitution (default: 0.3 — bounciness)
9. Spawn locations — enter as (x, y) pairs in meters separated by |
   e.g. "1.5, 4.0 | 2.0, 6.5 | 3.1, 2.0"
   Field-relative coordinates from the blue alliance origin.
```

Repeat until the user says "done".

---

## Step 3: Generate MapleSimSwerveDrivetrain.java

Read the full template from:
→ `references/MapleSimSwerveDrivetrain-template.md`

IMPORTANT: This is NOT a MapleSim library class. It is a project-local utility class that must
be copied into the project. The skill fetches it from the CTRE-Swerve-MapleSim repo.

The only change from the official template: change the hardcoded initial spawn pose from
`new Pose2d()` to `new Pose2d(2.0, 4.025, new Rotation2d(0))` so the robot spawns inside
the field instead of at (0, 0) which is outside the field boundary.

Write to:
`src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java`

---

## Step 4: Generate SimManager.java

Read the reference file:
→ `references/SimManager-template.md`

Critical rules — these were real bugs that broke sim:

1. Use the correct `GamePieceInfo` + `GamePieceOnFieldSimulation` API (see reference).
   The constructor does NOT take direct dimensions. It takes a `GamePieceInfo` record
   which wraps a dyn4j `Convex` shape object. For a cylinder use `new Circle(radiusInMeters)`.
   For a box use `new Rectangle(lengthInMeters, widthInMeters)`.

2. Do NOT include a `SimManager.update()` method. `MapleSimSwerveDrivetrain::update`
   already calls `SimulatedArena.getInstance().simulationPeriodic()` internally. Calling
   it again double-ticks the physics engine.

3. Include `publishPoses()` which reads game piece positions from
   `SimulatedArena.getInstance().getGamePiecesArrayByType(TYPE_NAME)` and publishes
   them as a `StructArrayPublisher<Pose2d>` to `"Simulation/{{GamePieceName}}Poses"`.

4. `initialize()` calls `resetFieldForAuto()` then `spawnGamePieces()`.

5. `resetField()` calls `resetFieldForAuto()` then `spawnGamePieces()`. This is called
   between modes so game pieces respawn correctly.

Write to:
`src/main/java/frc/robot/utils/simulation/SimManager.java`

---

## Step 5: Update Swerve.java

Read the reference file:
→ `references/Swerve-sim-thread-template.md`

Changes to make — each one fixed a real bug:

1. Do NOT add explicit `import static edu.wpi.first.units.Units.Seconds/Pounds/Inches`.
   The file already has `import static edu.wpi.first.units.Units.*` which covers all three.
   Adding them again causes duplicate import warnings that break the build.

2. Add `private MapleSimSwerveDrivetrain mapleSimSwerveDrivetrain = null;` field.

3. Replace `startSimThread()` entirely with the MapleSim version. The notifier lambda
   should only call `mapleSimSwerveDrivetrain::update` — do NOT add `SimManager.update()`.

4. Add `resetPose()` override that syncs the sim world pose via
   `mapleSimSwerveDrivetrain.mapleSimDrive.setSimulationWorldPose(pose)`.

5. Add a `StructPublisher<Pose2d> simPosePublisher` field publishing to `"Simulation/RobotPose"`.

6. In `periodic()`, publish `mapleSimSwerveDrivetrain.mapleSimDrive.getSimulatedDriveTrainPose()`
   guarded by a null check on `mapleSimSwerveDrivetrain`.

7. Do NOT call `regulateModuleConstantsForSimulation()` here — it belongs in StateMachine (Step 6).

Write the updated file to:
`src/main/java/frc/robot/subsystems/Swerve.java`

---

## Step 6: Update StateMachine.java

Add a static initializer block at the very top of the `StateMachine` class body, before any
field declarations. This regulates module constants BEFORE the drivetrain is constructed.

IMPORTANT: This must happen before `Constants.Tuner.createDrivetrain()` is called. Doing it
inside `startSimThread()` is too late — CTRE has already applied the original constants to
hardware by that point, causing the steer PID to go unstable and the swerve motors to spin
uncontrollably as soon as sim is enabled.

```java
static {
    if (edu.wpi.first.wpilibj.RobotBase.isSimulation()) {
        frc.robot.constants.TunerConstants.FrontLeft =
            org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain
                .regulateModuleConstantsForSimulation(frc.robot.constants.TunerConstants.FrontLeft);
        frc.robot.constants.TunerConstants.FrontRight =
            org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain
                .regulateModuleConstantsForSimulation(frc.robot.constants.TunerConstants.FrontRight);
        frc.robot.constants.TunerConstants.BackLeft =
            org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain
                .regulateModuleConstantsForSimulation(frc.robot.constants.TunerConstants.BackLeft);
        frc.robot.constants.TunerConstants.BackRight =
            org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain
                .regulateModuleConstantsForSimulation(frc.robot.constants.TunerConstants.BackRight);
    }
}
```

---

## Step 7: Update Robot.java

Add the following to `Robot.java`, all guarded by `RobotBase.isSimulation()`:

In `autonomousInit()`:
```java
if (RobotBase.isSimulation()) SimManager.resetField();
```

In `teleopInit()`:
```java
if (RobotBase.isSimulation()) SimManager.resetField();
```

In `robotPeriodic()`:
```java
if (RobotBase.isSimulation()) SimManager.publishPoses();
```

Also add the import:
```java
import frc.robot.utils.simulation.SimManager;
```

---

## Step 8: Generate sim-config.md

Write to the robot project root: `sim-config.md`

Include:
- Table of all robot physical values entered
- Table of all game piece definitions (shape, mass, damping, restitution, spawn locations)
- How to run simulation: `./gradlew simulateJava`
- How to view in AdvantageScope:
  - Connect to simulation
  - Subscribe to `Simulation/RobotPose` for the MapleSim ground-truth robot pose
  - Subscribe to `Simulation/{{GamePieceName}}Poses` for game piece positions
- How to add a new game piece type later:
  1. Add a new `GamePieceInfo` constant in `SimManager.java`
  2. Add spawn calls in `spawnGamePieces()`
  3. Add a publisher and publish call in `publishPoses()`
- Known MapleSim version: `0.4.0-beta`
- Note: `MapleSimSwerveDrivetrain.java` is a project-local utility, not a library class.
  To update: fetch the latest from https://github.com/Shenzhen-Robotics-Alliance/CTRE-Swerve-MapleSim

---

## Step 9: Confirm and Summary

Tell the user which files were written and remind them:
- Run `./gradlew build` to verify everything compiles
- Robot spawns at (2.0, 4.025) — center of the blue alliance half
- Game pieces respawn automatically when switching between auto and teleop
- `Simulation/RobotPose` = MapleSim ground-truth pose (not odometry estimate)
- `Simulation/{{GamePieceName}}Poses` = live game piece positions

---

## DCMotor Mapping Table

| User Choice     | Java Expression              |
|-----------------|------------------------------|
| Kraken X60      | `DCMotor.getKrakenX60(1)`    |
| Kraken X60 FOC  | `DCMotor.getKrakenX60Foc(1)` |
| Kraken X44      | `DCMotor.getKrakenX44(1)`    |
| Falcon 500      | `DCMotor.getFalcon500(1)`    |
| NEO             | `DCMotor.getNEO(1)`          |
| NEO 550         | `DCMotor.getNeo550(1)`       |

## MapleSimSwerveDrivetrain Constructor Signature

```java
new MapleSimSwerveDrivetrain(
    Seconds.of(kSimLoopPeriod),
    Pounds.of(robotWeight),
    Inches.of(bumperLength),
    Inches.of(bumperWidth),
    driveMotor,           // DCMotor
    steerMotor,           // DCMotor
    wheelCOF,             // double
    getModuleLocations(),
    getPigeon2(),
    getModules(),
    TunerConstants.FrontLeft,
    TunerConstants.FrontRight,
    TunerConstants.BackLeft,
    TunerConstants.BackRight
);
```

## Required Imports for Swerve.java

```java
// Do NOT add Seconds/Pounds/Inches — Units.* already covers them
import org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain;
import frc.robot.utils.simulation.SimManager;
import edu.wpi.first.math.system.plant.DCMotor;
import edu.wpi.first.networktables.StructPublisher;
```

## Required Imports for SimManager.java

```java
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.gamepieces.GamePieceInfo;
import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation;
import org.dyn4j.geometry.Circle;
import org.dyn4j.geometry.Rectangle;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StructArrayPublisher;
import static edu.wpi.first.units.Units.Kilograms;
import static edu.wpi.first.units.Units.Inches;
import static edu.wpi.first.units.Units.Meters;
```
