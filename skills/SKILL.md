---
name: powerlib-sim
description: >
  Use this skill whenever a Team 9410 PowerLib robot project needs MapleSim simulation set up,
  configured, or regenerated from scratch. Triggers on any mention of "sim setup", "simulation",
  "maple sim", "SimManager", "game pieces in sim", or "set up sim" in the context of the Robot-Library
  / PowerLib codebase. This skill guides the user through collecting all required physical robot values
  and game piece definitions, then generates MapleSimSwerveDrivetrain.java, SimManager.java, updates
  Swerve.java and Robot.java, and writes a sim-config.md reference doc.
---

# PowerLib Sim Setup Skill

This skill collects robot physical properties and game piece definitions from the user, then generates
all MapleSim integration files for a Team 9410 PowerLib robot project.

## What Gets Generated / Modified

| File | Action |
|------|--------|
| `gradle.properties` | Created — pins Gradle to WPILib JDK 17 |
| `src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java` | Created — MapleSim physics wrapper, correct API, damping fix, heading sync |
| `src/main/java/frc/robot/utils/simulation/SimManager.java` | Created — correct GamePieceInfo 7-field API, Pose3d publishing |
| `src/main/java/frc/robot/subsystems/Swerve.java` | Modified — startSimThread(), sim pose publisher |
| `src/main/java/frc/robot/Robot.java` | Modified — simulationPeriodic(), resetField(), publishPoses() |
| `sim-config.md` | Created — reference doc |

## What Does NOT Change

- `StateMachine.java` — no static block needed (see Problem 2 note below)
- `VelocitySubsystemIOSim`, `PositionSubsystemIOSim`, `AbsolutePositionSubsystemIOSim`
- All other PowerLib library files
- `RobotContainer.java`, constants files

---

## KNOWN CLASS / API FACTS FOR MAPLE-SIM 0.4.0-BETA

Read this section before generating any file. These are verified against the actual JAR.

### Classes that DO exist in the vendordep
- `org.ironmaple.simulation.SimulatedArena`
- `org.ironmaple.simulation.drivesims.SwerveDriveSimulation`
- `org.ironmaple.simulation.drivesims.SelfControlledSwerveDriveSimulation`
- `org.ironmaple.simulation.drivesims.AbstractDriveTrainSimulation`
- `org.ironmaple.simulation.drivesims.configs.DriveTrainSimulationConfig`
- `org.ironmaple.simulation.drivesims.configs.SwerveModuleSimulationConfig`
- `org.ironmaple.simulation.drivesims.COTS`
- `org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation`
- `org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation.GamePieceInfo` (nested record)

### Classes that DO NOT exist in the vendordep
- `org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain` — does NOT exist
- `org.ironmaple.simulation.drivesims.CTRESwerveDrivetrainSimulation` — does NOT exist
- There is NO `regulateModuleConstantsForSimulation()` method anywhere in the library

### Key API signatures (verified from source)

`DriveTrainSimulationConfig.withGyro()`:
```java
// Takes Supplier<GyroSimulation>, NOT a class literal
.withGyro(COTS.ofPigeon2())
```

`DriveTrainSimulationConfig.withSwerveModule()`:
```java
// Takes Supplier<SwerveModuleSimulation>
// SwerveModuleSimulationConfig implements Supplier<SwerveModuleSimulation>
// so passing a SwerveModuleSimulationConfig instance directly is correct
.withSwerveModule(new SwerveModuleSimulationConfig(...))
```

`SwerveModuleSimulationConfig` constructor — 9 parameters (verified via javap):
```java
new SwerveModuleSimulationConfig(
    DCMotor,           // drive motor
    DCMotor,           // steer motor
    double,            // drive gear ratio
    double,            // steer gear ratio
    Voltage,           // drive friction voltage  — use kDriveFrictionVoltage from TunerConstants
    Voltage,           // steer friction voltage  — use kSteerFrictionVoltage from TunerConstants
    Distance,          // wheel radius
    MomentOfInertia,   // steer MOI              — use kSteerInertia from TunerConstants
    double)            // wheel COF
```

Do NOT use a 6-parameter form — it does not exist in 0.4.0-beta.

Example using PowerLib TunerConstants values:
```java
.withSwerveModule(new SwerveModuleSimulationConfig(
    DCMotor.getKrakenX60(1),
    DCMotor.getKrakenX44(1),
    5.4,                           // kDriveGearRatio
    12.1,                          // kSteerGearRatio
    Volts.of(0.2),                 // kDriveFrictionVoltage
    Volts.of(0.2),                 // kSteerFrictionVoltage
    Meters.of(0.0508),             // wheel radius (2 inches)
    KilogramSquareMeters.of(0.01), // kSteerInertia
    1.2))                          // wheel COF
```

Note: `KilogramSquareMeters.of(...)` and `Volts.of(...)` are covered by
`import static edu.wpi.first.units.Units.*` — do NOT add explicit measure imports.

`GamePieceInfo` record — 7 fields, not 4:
```java
public record GamePieceInfo(
    String type,
    Convex shape,           // dyn4j Convex — use new Circle(radiusMeters) or new Rectangle(l, w)
    Distance gamePieceHeight,
    Mass gamePieceMass,
    double linearDamping,
    double angularDamping,
    double coefficientOfRestitution)
```

`SimulatedArena.getGamePiecesArrayByType()` returns `Pose3d[]` not `Pose2d[]`:
```java
public synchronized Pose3d[] getGamePiecesArrayByType(String type)
```

### CTRE internal sim — do NOT duplicate

`SwerveDrivetrain` (the CTRE base class that `Swerve` extends) already creates an internal
`SimSwerveDrivetrain` field (`m_simDrive`) and calls `m_simDrive.update(...)` inside
`updateSimState(double dtSeconds, double supplyVoltage)`. The existing 5ms Notifier in
`Swerve.java` already calls `updateSimState()` every loop.

Do NOT create a second `SimSwerveDrivetrain` in `MapleSimSwerveDrivetrain.java`. It would
double-simulate all CTRE motor states. The wrapper only owns `SwerveDriveSimulation`.

### WheelRadius type

`TunerConstants.FrontLeft.WheelRadius` is declared as `Distance` (e.g. `Inches.of(2)`),
not a raw `double`. Do NOT wrap it in `Meters.of(...)` — that would fail to compile since
`Meters.of()` takes a `double` not a `Distance`.

Instead, hardcode the wheel radius from the known value in TunerConstants:
```java
Meters.of(0.0508)  // 2 inches — matches TunerConstants kWheelRadius = Inches.of(2)
```

Or read the double value:
```java
TunerConstants.FrontLeft.WheelRadius.in(Meters)
```

---

## Step 1: Fix Gradle JDK

Create `gradle.properties` in the project root:

```properties
org.gradle.java.home=C:\\Users\\Public\\wpilib\\2026\\jdk
```

Without this, Java 26 causes `Could not create task ':test' > Type T not present`.

---

## Step 2: Collect Robot Physical Properties

Ask the user for each value below as a numbered list:

```
1. Robot weight in pounds (typical: 100–130 lbs)
2. Bumper length in inches (outside edge to outside edge, front-to-back)
3. Bumper width in inches (outside edge to outside edge, side-to-side)
4. Wheel COF (default: 1.2 for Colsons, 1.5 for grippy treads)
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

---

## Step 3: Collect Game Piece Definitions

Tell the user:
> "Define the game pieces for this season. Enter 'done' when finished."

For each game piece, ask:
```
1. Name (e.g. "Ball", "Note", "Coral")
2. Shape:
      a) Cylinder — diameter in inches (FRC game pieces are usually described by diameter)
      b) Box — length x width in inches
3. Height in inches
4. Mass in kg
5. Linear damping (default: 0.8)
6. Angular damping (default: 0.8)
7. Coefficient of restitution (default: 0.3)
8. Spawn locations as (x, y) pairs in meters separated by |
   If the user does not provide spawn locations, use these defaults and tell the user:
   (2.0, 2.5) | (2.0, 5.5) | (4.0, 4.0) | (6.0, 2.5) | (6.0, 5.5)

NOTE: The user gives DIAMETER for cylinders. Always compute radius = diameter / 2 before
passing to Circle(). Example: user says 5.91 in diameter → Circle(Inches.of(2.955).in(Meters)).
```

---

## Step 4: Generate MapleSimSwerveDrivetrain.java

This is a project-local wrapper class. It does NOT exist in the MapleSim vendordep.
Generate the full file from scratch using the template below.

### Constructor — 3 parameters only

```java
public MapleSimSwerveDrivetrain(
    Translation2d[] moduleLocations,
    Supplier<ChassisSpeeds> robotRelativeSpeedsSupplier,
    Supplier<Rotation2d> headingSupplier)
```

Do NOT add Pigeon2, SwerveModule[], or SwerveModuleConstants[] — the CTRE base class
handles all of that internally via `updateSimState()`.

### DriveTrainSimulationConfig

```java
DriveTrainSimulationConfig config = DriveTrainSimulationConfig.Default()
    .withRobotMass(Pounds.of({{ROBOT_WEIGHT_LBS}}))
    .withBumperSize(Inches.of({{BUMPER_LENGTH_IN}}), Inches.of({{BUMPER_WIDTH_IN}}))
    .withGyro(COTS.ofPigeon2())  // Supplier<GyroSimulation>, NOT a class literal
    .withSwerveModule(new SwerveModuleSimulationConfig(
        {{DRIVE_MOTOR_EXPRESSION}},
        {{STEER_MOTOR_EXPRESSION}},
        {{DRIVE_GEAR_RATIO}},   // from TunerConstants: kDriveGearRatio
        {{STEER_GEAR_RATIO}},   // from TunerConstants: kSteerGearRatio
        Volts.of(0.2),          // kDriveFrictionVoltage from TunerConstants
        Volts.of(0.2),          // kSteerFrictionVoltage from TunerConstants
        Meters.of(0.0508),      // wheel radius hardcoded — WheelRadius is Distance not double
        KilogramSquareMeters.of(0.01), // kSteerInertia from TunerConstants
        {{WHEEL_COF}}));
```

### Full class structure

```java
package frc.robot.utils.simulation;

import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.SwerveDriveSimulation;
import org.ironmaple.simulation.drivesims.COTS;
import org.ironmaple.simulation.drivesims.configs.DriveTrainSimulationConfig;
import org.ironmaple.simulation.drivesims.configs.SwerveModuleSimulationConfig;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.math.system.plant.DCMotor;
import java.util.function.Supplier;
import static edu.wpi.first.units.Units.*;

public class MapleSimSwerveDrivetrain {

    public final SwerveDriveSimulation mapleSimDrive;
    private final Supplier<ChassisSpeeds> robotRelativeSpeedsSupplier;
    private final Supplier<Rotation2d> headingSupplier;

    public MapleSimSwerveDrivetrain(
            Translation2d[] moduleLocations,
            Supplier<ChassisSpeeds> robotRelativeSpeedsSupplier,
            Supplier<Rotation2d> headingSupplier) {

        this.robotRelativeSpeedsSupplier = robotRelativeSpeedsSupplier;
        this.headingSupplier = headingSupplier;

        DriveTrainSimulationConfig config = DriveTrainSimulationConfig.Default()
            .withRobotMass(Pounds.of({{ROBOT_WEIGHT_LBS}}))
            .withBumperSize(Inches.of({{BUMPER_LENGTH_IN}}), Inches.of({{BUMPER_WIDTH_IN}}))
            .withGyro(COTS.ofPigeon2())
            .withSwerveModule(new SwerveModuleSimulationConfig(
                {{DRIVE_MOTOR_EXPRESSION}},
                {{STEER_MOTOR_EXPRESSION}},
                {{DRIVE_GEAR_RATIO}},
                {{STEER_GEAR_RATIO}},
                Volts.of(0.2),             // kDriveFrictionVoltage from TunerConstants
                Volts.of(0.2),             // kSteerFrictionVoltage from TunerConstants
                Meters.of(0.0508),         // wheel radius (2 inches)
                KilogramSquareMeters.of(0.01), // kSteerInertia from TunerConstants
                {{WHEEL_COF}}));

        // Initial pose — NOT new Pose2d() which places robot outside the field at (0,0)
        mapleSimDrive = new SwerveDriveSimulation(config,
            new Pose2d(2.0, 4.025, new Rotation2d(0)));

        // Zero damping — default of 1.4 fights setRobotSpeeds() making robot barely move
        mapleSimDrive.setLinearDamping(0);
        mapleSimDrive.setAngularDamping(0);

        SimulatedArena.getInstance().addDriveTrainSimulation(mapleSimDrive);
    }

    /**
     * Called from Robot.simulationPeriodic() at 20ms.
     * SimulatedArena.simulationPeriodic() runs 5 sub-ticks — calling at 200Hz = 40x real time.
     * setRobotSpeeds() takes FIELD-RELATIVE speeds. Applied before and after tick.
     * Uses CTRE heading to prevent MapleSim heading from diverging after rotation.
     */
    public void simulationPeriodic() {
        Rotation2d heading = headingSupplier.get();
        Pose2d currentPose = mapleSimDrive.getSimulatedDriveTrainPose();

        // Sync MapleSim pose to CTRE heading
        mapleSimDrive.setSimulationWorldPose(
            new Pose2d(currentPose.getTranslation(), heading));

        // setRobotSpeeds() needs field-relative, not robot-relative
        ChassisSpeeds fieldRelative = ChassisSpeeds.fromRobotRelativeSpeeds(
            robotRelativeSpeedsSupplier.get(), heading);

        // Apply before and after tick so speeds survive the arena update
        mapleSimDrive.setRobotSpeeds(fieldRelative);
        SimulatedArena.getInstance().simulationPeriodic();
        mapleSimDrive.setRobotSpeeds(fieldRelative);
    }

    public Pose2d getSimulatedDriveTrainPose() {
        return mapleSimDrive.getSimulatedDriveTrainPose();
    }

    public void setSimulationWorldPose(Pose2d pose) {
        mapleSimDrive.setSimulationWorldPose(pose);
    }
}
```

TunerConstants gear ratio values to use:
- `kDriveGearRatio` — look for `private static final double kDriveGearRatio` in TunerConstants
- `kSteerGearRatio` — look for `private static final double kSteerGearRatio` in TunerConstants

Write to:
`src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java`

---

## Step 5: Generate SimManager.java

```java
package frc.robot.utils.simulation;

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
import static edu.wpi.first.units.Units.*;

public class SimManager {

    // Type name constants
    {{GAME_PIECE_TYPE_CONSTANTS}}

    // GamePieceInfo — ALWAYS 7 fields: type, shape, height, mass, linearDamping, angularDamping, restitution
    // Shape is a dyn4j Convex: new Circle(radiusMeters) or new Rectangle(lengthMeters, widthMeters)
    {{GAME_PIECE_INFO_CONSTANTS}}

    // Publishers — getGamePiecesArrayByType() returns Pose3d[] NOT Pose2d[]
    {{GAME_PIECE_PUBLISHERS}}

    private SimManager() {}

    public static void initialize() {
        {{INIT_PUBLISHERS}}
        SimulatedArena.getInstance().resetFieldForAuto();
        spawnGamePieces();
    }

    // Call from Robot.autonomousInit() and Robot.teleopInit()
    public static void resetField() {
        SimulatedArena.getInstance().resetFieldForAuto();
        spawnGamePieces();
    }

    // Call from Robot.robotPeriodic() guarded by RobotBase.isSimulation()
    public static void publishPoses() {
        {{PUBLISH_POSES_BODY}}
    }

    private static void spawnGamePieces() {
        {{SPAWN_GAME_PIECES_BODY}}
    }
}
```

### Filling in the game piece sections

GamePieceInfo example (cylinder, "Ball", radius 2.955 in, height 5.91 in):
```java
private static final GamePieceInfo BALL_INFO = new GamePieceInfo(
    BALL_TYPE,
    new Circle(Inches.of(2.955).in(Meters)),
    Inches.of(5.91),
    Kilograms.of(0.227),
    0.8, 0.8, 0.3);
```

GamePieceInfo example (box, "Coral", 12x8 in footprint, height 6 in):
```java
private static final GamePieceInfo CORAL_INFO = new GamePieceInfo(
    CORAL_TYPE,
    new Rectangle(Inches.of(12.0).in(Meters), Inches.of(8.0).in(Meters)),
    Inches.of(6.0),
    Kilograms.of(0.18),
    0.8, 0.8, 0.3);
```

Publisher (Pose3d — not Pose2d):
```java
private static StructArrayPublisher<Pose3d> ballPosesPublisher;
```

Init publisher:
```java
ballPosesPublisher = NetworkTableInstance.getDefault()
    .getStructArrayTopic("Simulation/BallPoses", Pose3d.struct)
    .publish();
```

Publish poses:
```java
if (ballPosesPublisher != null) {
    ballPosesPublisher.set(
        SimulatedArena.getInstance().getGamePiecesArrayByType(BALL_TYPE));
}
```

Spawn:
```java
SimulatedArena.getInstance().addGamePiece(
    new GamePieceOnFieldSimulation(BALL_INFO, new Pose2d(1.5, 4.0, new Rotation2d())));
```

Write to:
`src/main/java/frc/robot/utils/simulation/SimManager.java`

---

## Step 6: Update Swerve.java

### Add field declarations

Find `private Notifier m_simNotifier = null;` and add after it:

```java
private MapleSimSwerveDrivetrain mapleSimSwerveDrivetrain = null;
private final StructPublisher<Pose2d> simPosePublisher =
    NetworkTableInstance.getDefault()
        .getStructTopic("Simulation/RobotPose", Pose2d.struct)
        .publish();
```

### Replace startSimThread()

```java
private void startSimThread() {
    // Initialize m_lastSimTime first — must happen before the Notifier fires.
    // Leaving it at 0.0 causes a massive deltaTime on the first tick equal to robot uptime.
    m_lastSimTime = Utils.getCurrentTimeSeconds();

    // 3 parameters only — CTRE base class handles motor/encoder sim internally
    mapleSimSwerveDrivetrain = new MapleSimSwerveDrivetrain(
        getModuleLocations(),
        () -> getState().Speeds,
        () -> getState().Pose.getRotation());

    SimManager.initialize();

    // Existing Notifier already calls updateSimState() (CTRE motor sim) every 5ms
    // Do NOT add a second Notifier or call SimulatedArena here
    // SimulatedArena.simulationPeriodic() runs at 20ms in Robot.simulationPeriodic()
    if (m_simNotifier != null) m_simNotifier.close();
    m_simNotifier = new Notifier(() -> {
        final double currentTime = Utils.getCurrentTimeSeconds();
        double deltaTime = currentTime - m_lastSimTime;
        m_lastSimTime = currentTime;
        updateSimState(deltaTime, RobotController.getBatteryVoltage());
    });
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```

### Add simulationPeriodic()

```java
public void simulationPeriodic() {
    if (mapleSimSwerveDrivetrain != null) {
        mapleSimSwerveDrivetrain.simulationPeriodic();
    }
}
```

### Add resetPose() override

```java
@Override
public void resetPose(Pose2d pose) {
    if (mapleSimSwerveDrivetrain != null) {
        mapleSimSwerveDrivetrain.setSimulationWorldPose(pose);
    }
    Timer.delay(0.05);
    super.resetPose(pose);
}
```

### Add to periodic()

```java
if (mapleSimSwerveDrivetrain != null) {
    simPosePublisher.set(mapleSimSwerveDrivetrain.getSimulatedDriveTrainPose());
}
```

### Imports to add

Before adding any import, check the existing Swerve.java imports. Several may already be
present — adding duplicates causes compiler warnings. Only add imports that are not already there:

```java
import frc.robot.utils.simulation.MapleSimSwerveDrivetrain;
import frc.robot.utils.simulation.SimManager;
import edu.wpi.first.networktables.StructPublisher;  // may already exist — check first
import edu.wpi.first.wpilibj.Timer;
```

Do NOT add `Seconds`, `Pounds`, or `Inches` — `Units.*` already covers them.

Write to:
`src/main/java/frc/robot/subsystems/Swerve.java`

---

## Step 7: Update Robot.java

Before writing anything, read these three files to verify the full access chain:
1. `Robot.java` — find the field name for `RobotContainer` (e.g. `m_robotContainer`)
2. `RobotContainer.java` — verify `getStateMachine()` exists and returns `StateMachine`
3. `StateMachine.java` — verify `drivetrain` is a public field of type `Swerve`

Do not assume the chain is always `getStateMachine().drivetrain` — trace it from the source.

Add `simulationPeriodic()` — this is where arena physics ticks at 20ms:

```java
@Override
public void simulationPeriodic() {
    // Replace {{ROBOT_CONTAINER_FIELD}} with the actual field name from Robot.java
    // Replace the chain with whatever path leads to the Swerve instance
    {{ROBOT_CONTAINER_FIELD}}.getStateMachine().drivetrain.simulationPeriodic();
}
```

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
// publishPoses() goes here rather than simulationPeriodic() so NT publishing
// runs every 20ms robot loop regardless of sim configuration details.
// The isSimulation() guard prevents it running on real hardware.
if (RobotBase.isSimulation()) SimManager.publishPoses();
```

Add import:
```java
import frc.robot.utils.simulation.SimManager;
```

Write to:
`src/main/java/frc/robot/Robot.java`

---

## Step 8: Generate sim-config.md

Write to project root. Include:
- Table of robot physical values entered
- Table of game piece definitions (all 7 GamePieceInfo fields)
- `gradle.properties` must point to WPILib JDK 17
- How to run: `./gradlew simulateJava`
- AdvantageScope: subscribe to `Simulation/RobotPose` (Pose2d) and
  `Simulation/{{Name}}Poses` (Pose3d array)
- Physics timing: arena at 20ms in `Robot.simulationPeriodic()`,
  CTRE motor sim at 5ms in Swerve Notifier
- `MapleSimSwerveDrivetrain.java` is project-local, not a library class
- No `regulateModuleConstantsForSimulation()` — that method does not exist in 0.4.0-beta

---

## Step 9: Confirm and Summary

Tell the user which files were written and remind them:
- Run `./gradlew build` to verify
- Robot spawns at (2.0, 4.025) — inside the blue alliance half
- `Simulation/RobotPose` = MapleSim ground-truth pose
- `Simulation/{{Name}}Poses` = Pose3d array of game piece positions
- StateMachine.java does NOT need a static block — `regulateModuleConstantsForSimulation()` does not exist

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
