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
| `gradle.properties` | Created — pins Gradle to WPILib JDK 17 to avoid Java 26 incompatibility |
| `src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java` | Created — correct class names, damping fix, heading sync, CTRE sim wiring |
| `src/main/java/frc/robot/utils/simulation/SimManager.java` | Created — correct GamePieceInfo API, Pose3d publishing, no double-tick |
| `src/main/java/frc/robot/subsystems/Swerve.java` | Modified — fixed imports, startSimThread(), sim pose publisher, suppliers |
| `src/main/java/frc/robot/subsystems/StateMachine.java` | Modified — pre-construction module constant regulation |
| `src/main/java/frc/robot/Robot.java` | Modified — simulationPeriodic() at 20ms, resetField(), publishPoses() |
| `sim-config.md` | Created — reference doc |

## What Does NOT Change

- `VelocitySubsystemIOSim`, `PositionSubsystemIOSim`, `AbsolutePositionSubsystemIOSim`
- All other PowerLib library files
- `RobotContainer.java`, constants files

---

## Step 1: Fix Gradle JDK Before Anything Else

Create `gradle.properties` in the robot project root if it does not already exist:

```properties
org.gradle.java.home=C:\\Users\\Public\\wpilib\\2026\\jdk
```

This pins Gradle to WPILib's bundled JDK 17. Without this, if Java 26 (or any non-17 JDK)
is installed on the system, Gradle's test task fails with:
`Could not create task ':test' > Type T not present`

---

## Step 2: Collect Robot Physical Properties

Ask the user for each value below as a numbered list. Wait for all answers before proceeding.

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

Values pulled automatically — do NOT ask the user:
- `kSimLoopPeriod = 0.005` (already in Swerve.java)
- `TunerConstants.FrontLeft.WheelRadius` (raw double in meters — wrap as `Meters.of(...)`)
- Module locations, Pigeon2, modules from Swerve getters

---

## Step 3: Collect Game Piece Definitions

Tell the user:

> "Now define the game pieces for this season. Enter 'done' when finished."

For each game piece, ask:

```
1. Name (e.g. "Ball", "Note", "Coral")
2. Shape:
      a) Cylinder (radius in inches)
      b) Box (length x width in inches)
3. Height in inches
4. Mass in kg
5. Linear damping (default: 0.8)
6. Angular damping (default: 0.8)
7. Coefficient of restitution (default: 0.3)
8. Spawn locations as (x, y) pairs in meters, separated by |
```

---

## Step 4: Generate gradle.properties

Write to project root:

```properties
org.gradle.java.home=C:\\Users\\Public\\wpilib\\2026\\jdk
```

---

## Step 5: Generate MapleSimSwerveDrivetrain.java

Read the full reference:
→ `references/MapleSimSwerveDrivetrain-template.md`

Critical rules — every one of these was a real bug:

1. The MapleSim physics drivetrain class is `org.ironmaple.simulation.drivesims.SwerveDriveSimulation`.
   There is NO class named `CTRESwerveDrivetrainSimulation` in the vendordep. Do not use it.

2. CTRE's motor/encoder sim is a SEPARATE class: `com.ctre.phoenix6.swerve.SimSwerveDrivetrain`.
   Both are needed. `SwerveDriveSimulation` handles physics. `SimSwerveDrivetrain` handles
   CTRE motor and encoder state updates.

3. `TunerConstants.FrontLeft.WheelRadius` is a raw `double` (meters), not a `Distance`.
   Wrap it: `Meters.of(TunerConstants.FrontLeft.WheelRadius)`.

4. `SimSwerveDrivetrain` constructor signature:
   ```java
   new SimSwerveDrivetrain(
       Translation2d[] moduleLocations,
       Pigeon2SimState pigeonSim,
       SwerveModuleConstants<?,?,?>... moduleConstants)
   ```
   Its update method:
   ```java
   ctreSimDrivetrain.update(double dtSeconds, double supplyVoltage, SwerveModule<?,?,?>... modules)
   ```

5. Physics timing — this is critical. `SimulatedArena.simulationPeriodic()` runs 5 internal
   sub-ticks. If called from the 5ms notifier (200 Hz), that is 1000 sub-ticks/second —
   40x real time. The robot teleports across the field.
   CORRECT split:
   - `update()` → called from 5ms Notifier → only calls `ctreSimDrivetrain.update(...)`
   - `simulationPeriodic()` → called from `Robot.simulationPeriodic()` at 20ms →
     calls `SimulatedArena.getInstance().simulationPeriodic()`

6. Zero out damping after constructing `mapleSimDrive`:
   ```java
   mapleSimDrive.setLinearDamping(0);
   mapleSimDrive.setAngularDamping(0);
   ```
   Default damping (1.4) fights the velocity set by `setRobotSpeeds()` and makes the
   robot barely move or move erratically.

7. `setRobotSpeeds()` takes FIELD-RELATIVE speeds, not robot-relative. Always convert:
   ```java
   ChassisSpeeds fieldRelative = ChassisSpeeds.fromRobotRelativeSpeeds(
       robotRelativeSpeedsSupplier.get(), heading);
   mapleSimDrive.setRobotSpeeds(fieldRelative);
   ```

8. MapleSim's internal heading diverges from CTRE's Pigeon2 heading after rotation.
   Use CTRE's heading (not MapleSim's) for all conversions. The constructor takes two
   additional suppliers:
   ```java
   Supplier<ChassisSpeeds> robotRelativeSpeedsSupplier,
   Supplier<Rotation2d> headingSupplier
   ```
   In `simulationPeriodic()`, sync MapleSim's pose to CTRE's heading before every tick:
   ```java
   Rotation2d heading = headingSupplier.get();
   mapleSimDrive.setSimulationWorldPose(new Pose2d(currentPose.getTranslation(), heading));
   ```
   Apply speeds both before AND after the arena tick so they are not lost to damping:
   ```java
   mapleSimDrive.setRobotSpeeds(fieldRelative);
   SimulatedArena.getInstance().simulationPeriodic();
   mapleSimDrive.setRobotSpeeds(fieldRelative);
   ```

9. Initial spawn pose must NOT be `new Pose2d()` — that places the robot at (0,0) which
   is outside the field. Use `new Pose2d(2.0, 4.025, new Rotation2d(0))`.

10. Do not leave orphaned field assignments in the constructor. If a field is removed from
    the class body, remove its assignment from the constructor too or the build will fail
    with `kinematics cannot be resolved or is not a field`.

Write to:
`src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java`

---

## Step 6: Generate SimManager.java

Read the reference:
→ `references/SimManager-template.md`

Critical rules:

1. `GamePieceInfo` is a record nested inside `GamePieceOnFieldSimulation`, not a standalone
   class. Import it as:
   ```java
   import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation.GamePieceInfo;
   ```

2. The shape parameter is a dyn4j `Convex` object:
   - Cylinder: `new Circle(Inches.of(radius).in(Meters))`
   - Box: `new Rectangle(Inches.of(length).in(Meters), Inches.of(width).in(Meters))`

3. `getGamePiecesArrayByType()` returns `Pose3d[]` NOT `Pose2d[]`. Use
   `StructArrayPublisher<Pose3d>` and `Pose3d.struct`. Using Pose2d causes a type mismatch
   and AdvantageScope receives no data.

4. Do NOT include `SimManager.update()`. `MapleSimSwerveDrivetrain.update()` handles CTRE
   motor sim at 5ms. `SimulatedArena.simulationPeriodic()` runs in `Robot.simulationPeriodic()`
   at 20ms. Calling it a third time anywhere breaks physics timing.

5. `publishPoses()` reads from `SimulatedArena.getInstance().getGamePiecesArrayByType(TYPE)`
   which returns `Pose3d[]` directly — no mapping needed.

Write to:
`src/main/java/frc/robot/utils/simulation/SimManager.java`

---

## Step 7: Update Swerve.java

Read the reference:
→ `references/Swerve-sim-thread-template.md`

Critical rules:

1. Do NOT add `import static edu.wpi.first.units.Units.Seconds/Pounds/Inches` —
   `Units.*` already covers them. Duplicate imports break the build.

2. `startSimThread()` passes two additional suppliers to `MapleSimSwerveDrivetrain`:
   ```java
   () -> getState().Speeds,             // robot-relative speeds supplier
   () -> getState().Pose.getRotation()  // CTRE heading supplier
   ```

3. Add `StructPublisher<Pose2d> simPosePublisher` publishing to `"Simulation/RobotPose"`.

4. In `periodic()`, publish the MapleSim ground-truth pose guarded by null check:
   ```java
   if (mapleSimSwerveDrivetrain != null) {
       simPosePublisher.set(
           mapleSimSwerveDrivetrain.mapleSimDrive.getSimulatedDriveTrainPose());
   }
   ```

5. `WheelRadius` from TunerConstants is a raw double — wrap as `Meters.of(...)`.

6. Do NOT call `regulateModuleConstantsForSimulation()` here (see Step 8).

Write to:
`src/main/java/frc/robot/subsystems/Swerve.java`

---

## Step 8: Update StateMachine.java

Add a static block at the top of the class body before any field declarations:

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

This must run before `Constants.Tuner.createDrivetrain()`. Doing it in `startSimThread()`
is too late and causes swerve motors to spin uncontrollably in sim.

---

## Step 9: Update Robot.java

Add the following, all guarded by `RobotBase.isSimulation()`:

In `simulationPeriodic()` (create this method if it does not exist):
```java
@Override
public void simulationPeriodic() {
    if (RobotBase.isSimulation()) {
        robotContainer.getStateMachine().drivetrain.simulationPeriodic();
    }
}
```

This is where `SimulatedArena.simulationPeriodic()` runs — at 20ms, not 5ms.
Running it at 5ms causes physics to run 40x too fast.

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

Also add:
```java
import frc.robot.utils.simulation.SimManager;
```

---

## Step 10: Generate sim-config.md

Write to the robot project root: `sim-config.md`

Include:
- Table of all robot physical values entered
- Table of all game piece definitions
- `gradle.properties` note: must point to WPILib JDK 17
- How to run: `./gradlew simulateJava`
- AdvantageScope: subscribe to `Simulation/RobotPose` and `Simulation/{{Name}}Poses`
- How to add a new game piece type later
- MapleSim version: `0.4.0-beta`
- Physics timing note: `simulationPeriodic()` runs at 20ms in `Robot.simulationPeriodic()`.
  Never call `SimulatedArena.simulationPeriodic()` from the 5ms notifier.

---

## Step 11: Confirm and Summary

Tell the user which files were written and remind them:
- Run `./gradlew build` to verify everything compiles
- Robot spawns at (2.0, 4.025) — inside the blue alliance half
- Physics runs at 20ms via `Robot.simulationPeriodic()`, motor sim at 5ms via Notifier
- `Simulation/RobotPose` = MapleSim ground-truth pose
- `Simulation/{{Name}}Poses` = live game piece positions as Pose3d array

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

## Required Imports for MapleSimSwerveDrivetrain.java

```java
import com.ctre.phoenix6.swerve.SimSwerveDrivetrain;
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.SwerveDriveSimulation;
import org.ironmaple.simulation.drivesims.configs.DriveTrainSimulationConfig;
import org.ironmaple.simulation.drivesims.configs.SwerveModuleSimulationConfig;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj.RobotController;
import java.util.function.Supplier;
```

## Required Imports for SimManager.java

```java
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation;
import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation.GamePieceInfo;
import org.dyn4j.geometry.Circle;
import org.dyn4j.geometry.Rectangle;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Pose3d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StructArrayPublisher;
import static edu.wpi.first.units.Units.Kilograms;
import static edu.wpi.first.units.Units.Inches;
import static edu.wpi.first.units.Units.Meters;
```

## Required Imports for Swerve.java additions

```java
// Do NOT add Seconds/Pounds/Inches — Units.* already covers them
import com.ctre.phoenix6.swerve.SimSwerveDrivetrain;
import org.ironmaple.simulation.drivesims.SwerveDriveSimulation;
import frc.robot.utils.simulation.SimManager;
import edu.wpi.first.math.system.plant.DCMotor;
import edu.wpi.first.networktables.StructPublisher;
import java.util.function.Supplier;
```
