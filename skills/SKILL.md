---
name: powerlib-sim
description: >
  Use this skill whenever a Team 9410 PowerLib robot project needs MapleSim simulation set up,
  configured, or regenerated from scratch. Triggers on any mention of "sim setup", "simulation",
  "maple sim", "SimManager", "game pieces in sim", or "set up sim" in the context of the Robot-Library
  / PowerLib codebase. This skill guides the user through collecting all required physical robot values
  and game piece definitions, then generates SimManager.java, updates Swerve.java's sim thread to use
  MapleSimSwerveDrivetrain, and writes a sim-config.md reference doc. Use this skill even if the user
  only mentions wanting to run simulation or test autonomous in sim.
---

# PowerLib Sim Setup Skill

This skill collects robot physical properties and game piece definitions from the user, then generates
all MapleSim integration files for a Team 9410 PowerLib robot project.

## What Gets Generated

1. `src/main/java/frc/robot/utils/simulation/SimManager.java` — initializes the MapleSim arena,
   wires `MapleSimSwerveDrivetrain`, and manages game piece spawning
2. Updated `startSimThread()` block for `Swerve.java` — replaces the basic WPILib sim with MapleSim
3. `sim-config.md` — reference doc with all entered values, how to run sim, and how to add game pieces later

## What Does NOT Change

- `VelocitySubsystemIOSim`, `PositionSubsystemIOSim`, `AbsolutePositionSubsystemIOSim` — kept as-is
- All other PowerLib library files
- `StateMachine.java`, `RobotContainer.java`, constants files

---

## Step 1: Collect Robot Physical Properties

Ask the user for each value below. Present them as a numbered list and wait for all answers before
proceeding. If the user is unsure about a value, provide the default shown and explain where to find
the real number (CAD, weighing the robot, measuring with a tape measure).

```
1. Robot weight in pounds (typical FRC robot: 100–130 lbs)
2. Bumper length in inches (outside edge to outside edge, front-to-back)
3. Bumper width in inches (outside edge to outside edge, side-to-side)
4. Wheel coefficient of friction / COF (default: 1.2 for Colsons, 1.5 for grippy treads)
5. Drive motor type:
      a) Kraken X60 (default for PowerLib)
      b) Kraken X60 FOC
      c) Falcon 500
      d) NEO
6. Steer motor type:
      a) Kraken X44 (default for PowerLib)
      b) Kraken X60
      c) Falcon 500
      d) NEO 550
      e) NEO
```

Values pulled automatically from existing `TunerConstants.java` (do NOT ask the user for these):
- `kSimLoopPeriod = 0.005` (already in Swerve.java)
- Module locations: `TunerConstants.FrontLeft/FrontRight/BackLeft/BackRight`
- Pigeon2: `getPigeon2()`
- Modules: `getModules()`

---

## Step 2: Collect Game Piece Definitions

Tell the user:

> "Now let's define the game pieces for this season's field. You can add as many types as needed.
> For each game piece, I need a few properties. Enter 'done' when you have added all game piece types."

For each game piece, ask:

```
1. Name (e.g. "Note", "Coral", "Ball") — used as the Java class/enum name
2. Shape:
      a) Cylinder (for rings, balls, pucks)
      b) Box (for cubes, crates)
3. Mass in kg (typical game piece: 0.1–0.5 kg)
4. If cylinder: diameter in inches, height in inches
   If box: length in inches, width in inches, height in inches
5. Spawn locations on the field — enter as a list of (x, y) pairs in meters
   (e.g. "1.5, 4.0  |  2.0, 6.5  |  3.1, 2.0")
   These are field-relative coordinates from the blue alliance origin.
```

Repeat until the user says "done" or indicates no more game pieces.

---

## Step 3: Generate SimManager.java

Read the reference file for the full template:
→ `references/SimManager-template.md`

Fill in all user-provided values. Use the game piece list to generate:
- A `GamePiece` enum or set of named constants
- `spawnGamePieces()` method with one `SimulatedArena.getInstance().addGamePiece(...)` call per spawn location
- The correct `GamePieceOnFieldSimulation` constructor based on shape (cylinder vs box)

Write the file to:
`src/main/java/frc/robot/utils/simulation/SimManager.java`

---

## Step 4: Generate the Updated Swerve.java startSimThread()

Find the existing `startSimThread()` method in `Swerve.java` and replace it entirely.

Read the replacement template:
→ `references/Swerve-sim-thread-template.md`

Fill in:
- `robotWeightPounds` → user value from Step 1
- `bumperLengthInches` → user value
- `bumperWidthInches` → user value
- `driveMotorDCMotor` → mapped from user choice (see DCMotor mapping table in reference)
- `steerMotorDCMotor` → mapped from user choice
- `wheelCOF` → user value

Also add the `mapleSimSwerveDrivetrain` field declaration at the top of the `Swerve` class and
add `resetPose()` override. Both are in the reference file.

Write the updated `Swerve.java` to:
`src/main/java/frc/robot/subsystems/Swerve.java`

---

## Step 5: Generate sim-config.md

Write a markdown reference doc to the robot project root: `sim-config.md`

Include:
- Table of all robot physical values entered
- Table of all game piece definitions
- How to run simulation: `./gradlew simulateJava`
- How to add a new game piece type (edit `SimManager.java`, add enum entry, add spawn calls)
- Known MapleSim version: `0.4.0-beta`
- Link to MapleSim docs: https://shenzhen-robotics-alliance.github.io/maple-sim/

---

## Step 6: Confirm and Summary

Tell the user which files were written, and remind them:
- Run `./gradlew build` to verify everything compiles
- Open AdvantageScope and connect to simulation to see the field and robot
- Game piece spawn locations are field-relative from the blue alliance origin
- To change values later, edit `SimManager.java` directly or re-run this skill

---

## Notes for Code Generation

### DCMotor Mapping Table

| User Choice     | Java Expression              |
|-----------------|------------------------------|
| Kraken X60      | `DCMotor.getKrakenX60(1)`    |
| Kraken X60 FOC  | `DCMotor.getKrakenX60Foc(1)` |
| Kraken X44      | `DCMotor.getKrakenX44(1)`    |
| Falcon 500      | `DCMotor.getFalcon500(1)`    |
| NEO             | `DCMotor.getNEO(1)`          |
| NEO 550         | `DCMotor.getNeo550(1)`       |

### MapleSimSwerveDrivetrain Constructor Signature

```java
new MapleSimSwerveDrivetrain(
    Seconds.of(kSimLoopPeriod),
    Pounds.of(robotWeight),
    Inches.of(bumperLength),
    Inches.of(bumperWidth),
    driveMotor,       // DCMotor
    steerMotor,       // DCMotor
    wheelCOF,         // double
    getModuleLocations(),
    getPigeon2(),
    getModules(),
    TunerConstants.FrontLeft,
    TunerConstants.FrontRight,
    TunerConstants.BackLeft,
    TunerConstants.BackRight
);
```

### Required Imports for Swerve.java

```java
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain;
import frc.robot.utils.simulation.SimManager;
import edu.wpi.first.math.system.plant.DCMotor;
import static edu.wpi.first.units.Units.Seconds;
import static edu.wpi.first.units.Units.Pounds;
import static edu.wpi.first.units.Units.Inches;
```

### Required Imports for SimManager.java

```java
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation;
import static edu.wpi.first.units.Units.Kilograms;
import static edu.wpi.first.units.Units.Inches;
import static edu.wpi.first.units.Units.Meters;
import edu.wpi.first.math.geometry.Translation2d;
```
