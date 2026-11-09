---
name: powerlib-sim
description: >
  Set up, configure, or regenerate MapleSim simulation in a Team 9410 PowerLib robot project.
  Collects robot physical values, researches the season's game pieces and starting positions
  when a year is given, then generates MapleSimSwerveDrivetrain.java and SimManager.java,
  updates Swerve.java, RobotContainer.java and Robot.java, and writes sim-config.md.
  Triggers on: sim setup, set up sim, simulation, maple sim, MapleSim, SimManager,
  game pieces in sim, /powerlib-sim.
---

# PowerLib Sim Setup Skill

This skill collects robot physical properties, researches or collects game piece definitions,
then generates all MapleSim integration files for a Team 9410 PowerLib robot project.

## What Gets Generated / Modified

| File | Action |
|------|--------|
| `gradle.properties` | Created - pins Gradle to WPILib JDK 17 |
| `src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java` | Created - MapleSim physics wrapper, correct API, damping fix, heading sync |
| `src/main/java/frc/robot/utils/simulation/SimManager.java` | Created - correct GamePieceInfo 7-field API, Pose3d publishing |
| `src/main/java/frc/robot/subsystems/Swerve.java` | Modified - startSimThread(), sim pose publisher, CTRE/MapleSim initial pose sync |
| `src/main/java/frc/robot/RobotContainer.java` | Modified when needed - ensure StateMachine/default drive command wiring and getStateMachine() access |
| `src/main/java/frc/robot/Robot.java` | Modified - simulationPeriodic(), resetField(), publishPoses(), uses RobotContainer-owned drivetrain |
| `sim-config.md` | Created - reference doc |

## What Does NOT Change

- `StateMachine.java` - no static block needed; `regulateModuleConstantsForSimulation()` does not exist
- `VelocitySubsystemIOSim`, `AbsolutePositionSubsystemIOSim`, `RelativePositionSubsystemIOSim`
- All other PowerLib library files
- constants files

Do NOT create a second `StateMachine` in `Robot.java`. `RobotContainer` should own the
`StateMachine`; `Robot.java` should reach the drivetrain through `m_robotContainer.getStateMachine()`
or the equivalent chain traced from the actual project.

## NetworkTables Logging Rule

Use raw NetworkTables APIs for all generated logging/publishing. Do NOT import or use
`SmartDashboard`, and do NOT publish generated data under `/SmartDashboard`. Simulation-only
topics should stay under `/Simulation/...`; PowerLib dashboard data and commands, if touched,
belong under `/PowerLib/...`:

- Subsystem telemetry: one complete JSON data-map frame at `/PowerLib/Data` every 100 ms. Power Tool derives `/PowerLib/Subsystems/<SubsystemName>/Data/<Metric>` views locally; those scalar topics are no longer individually transmitted.
- AdvantageScope pose: `/PowerLib/Subsystems/Drive/Data/Pose` (`struct:Pose2d`), derived from the same captured map.
- Subsystem tunables: `/PowerLib/Subsystems/<SubsystemName>/Variables/<Variable>`
- Command tunables: `/PowerLib/Commands/<CommandName>/Variables/<Variable>`
- Tuning enable switch: `/PowerLib/Tuning/Enabled` (default false; robot code should only consume
  tunable variable values while this is true; dashboard code should poll this flag at about 1 Hz,
  not every robot loop)

## Files in this skill

Read each file when its step says to. Don't write sim code from memory: the
MapleSim 0.4.0-beta API differs from older examples online.

| File | Read it |
|------|---------|
| `maplesim-api-reference.md` | Before generating any file. Lists which classes exist, constructor signatures, and the CTRE sim you must not duplicate. |
| `MapleSimSwerveDrivetrain-template.md` | Step 4 |
| `SimManager-template.md` | Step 5 |
| `Swerve-sim-thread-template.md` | Step 6 |

The templates are the only copy of the generated code. Fill the `{{PLACEHOLDER}}` values and
keep everything else as written.

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
1. Robot weight in pounds (typical: 100-130 lbs)
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

## Step 3: Research or Collect Game Piece Definitions

First determine the season context:
- If the user provides an FRC year/season, research that year's game piece before asking them
  for physical details.
- If the user names a game piece but no year, ask for the season year unless the game piece
  details are already unambiguous from context.
- If the user explicitly wants custom/non-FRC game pieces, skip research and collect details manually.

When researching, use web search and prefer sources in this order:
1. Official FIRST game manual, field drawings, field CAD, Team Updates, or season page.
2. Official WPILib, AdvantageScope, or field-coordinate references when locating starting positions.
3. Team or community sources only when official sources do not provide dimensions, mass, or layout.

For every researched game piece, extract:
- Name/type
- Shape approximation for MapleSim: cylinder/circle footprint or box/rectangle footprint
- Diameter/radius or length/width
- Height/thickness
- Mass
- Field starting locations or staged locations, converted to WPILib field coordinates in meters
- Source URLs used for the values

If sources conflict, tell the user what conflicted and ask which value to use. If official sources
give dimensions/mass but not easy spawn coordinates, use the default positions below and say so.
Only ask the user for fields that are missing, ambiguous, or intentionally custom.

Tell the user:
> "Define the game pieces for this season. Enter 'done' when finished."

For manually entered or still-missing game piece details, ask only for the needed fields below.
Do not proceed to code generation until every field is known from research, defaults, or user input.
If any required field is missing, ask a follow-up question for that specific field before continuing.

```
1. Name (e.g. "Ball", "Note", "Coral")
2. Shape:
      a) Cylinder - size (see NOTE below)
      b) Box - length x width in inches
3. Height - REQUIRED. Ask explicitly if not provided. Accept inches or meters.
4. Mass in kg
5. Linear damping (default: 0.8)
6. Angular damping (default: 0.8)
7. Coefficient of restitution (default: 0.3)
8. Spawn locations as (x, y) pairs in meters separated by |
   If the user does not provide spawn locations, use these defaults and tell the user:
   (2.0, 2.5) | (2.0, 5.5) | (4.0, 4.0) | (6.0, 2.5) | (6.0, 5.5)
```

CYLINDER SIZE NOTE - accept any of these formats and convert appropriately:
- Diameter in inches -> radius = diameter / 2 -> `new Circle(Inches.of(radius).in(Meters))`
- Radius in inches -> `new Circle(Inches.of(radius).in(Meters))`
- Radius in meters -> `new Circle(radiusMeters)` directly, no conversion needed

If the user's response is ambiguous (e.g. just a number with no unit), ask whether it is
radius or diameter and whether it is inches or meters before generating code.

HEIGHT NOTE - accept inches or meters:
- Inches -> `Inches.of(value)`
- Meters -> `Meters.of(value)`

If height is not in the user's initial response, ask for it before proceeding.

---

## Step 4: Generate MapleSimSwerveDrivetrain.java

Read `MapleSimSwerveDrivetrain-template.md` and fill in its placeholders. This is a
project-local class; it is not in the MapleSim vendordep. Its constructor takes exactly 3
parameters. Don't add Pigeon2, `SwerveModule[]`, or `SwerveModuleConstants[]`: the CTRE base
class handles those through `updateSimState()`.

Placeholder values:

- `{{ROBOT_WEIGHT_LBS}}`, `{{BUMPER_LENGTH_IN}}`, `{{BUMPER_WIDTH_IN}}`, `{{WHEEL_COF}}`: from Step 2.
- `{{DRIVE_MOTOR_EXPRESSION}}`, `{{STEER_MOTOR_EXPRESSION}}`: from the DCMotor table at the end
  of this file.
- The rest come from `TunerConstants.java`. Read it and copy the literal values. These fields
  are all `private static final`, so `TunerConstants.kDriveGearRatio` will not compile:

| Placeholder | TunerConstants field | Type |
|-------------|----------------------|------|
| `{{DRIVE_GEAR_RATIO_VALUE}}` | `kDriveGearRatio` | `double` |
| `{{STEER_GEAR_RATIO_VALUE}}` | `kSteerGearRatio` | `double` |
| `{{DRIVE_FRICTION_VOLTAGE}}` | `kDriveFrictionVoltage` | `Voltage`, copy the number inside `Volts.of(...)` |
| `{{STEER_FRICTION_VOLTAGE}}` | `kSteerFrictionVoltage` | `Voltage`, copy the number inside `Volts.of(...)` |
| `{{STEER_INERTIA_VALUE}}` | `kSteerInertia` | `MomentOfInertia`, copy the number inside `KilogramSquareMeters.of(...)` |

---

## Step 5: Generate SimManager.java

Read `SimManager-template.md`. Fill each `{{...}}` section with one entry per game piece from
Step 3, following the examples in that file. When converting the game piece values:

- Cylinder: `new Circle(Inches.of(radius).in(Meters))`, or `new Circle(radiusMeters)` if the
  radius is already in meters. Halve a diameter first.
- Box: `new Rectangle(Inches.of(length).in(Meters), Inches.of(width).in(Meters))`.
- Height is a `Distance`: `Inches.of(value)` or `Meters.of(value)`, never `.in(Meters)`.
- Publisher topics are `Simulation/<Name>Poses`.

---

## Step 6: Update Swerve.java

Read `Swerve-sim-thread-template.md` and apply its six sections to
`src/main/java/frc/robot/subsystems/Swerve.java`. Check the existing imports first and add only
the missing ones.

---

## Step 7: Update Robot.java

Before writing anything, read these three files to verify the full access chain:
1. `Robot.java` - find the field name for `RobotContainer` (e.g. `m_robotContainer`)
2. `RobotContainer.java` - verify `getStateMachine()` exists and returns `StateMachine`
3. `StateMachine.java` - verify `drivetrain` is a public field of type `Swerve`

Do not assume the chain is always `getStateMachine().drivetrain` - trace it from the source.

If active `RobotContainer.java` is the bare WPILib skeleton or does not expose the drivetrain chain,
update it before changing `Robot.java`:
- Implement `PowerRobotContainer` if the project uses PowerLib dashboard data.
- Create a single `private final StateMachine stateMachine = new StateMachine();`.
- Create a single driver `CommandXboxController` field from `Constants.OI`.
- Configure driver controller button commands directly in `RobotContainer.configureBindings()`.
- Set the default swerve command:
  `stateMachine.drivetrain.setDefaultCommand(new SwerveDriveCommand(stateMachine.drivetrain, driverController));`
- Add `public StateMachine getStateMachine() { return stateMachine; }`.

Do not add `private final StateMachine m_stateMachine = new StateMachine();` to `Robot.java`.
That creates a second drivetrain: commands bind to one instance while simulation advances another.

Add `simulationPeriodic()` - this is where arena physics ticks at 20ms:

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
- Source URLs for researched game piece dimensions, mass, and spawn positions when research was used
- `gradle.properties` must point to WPILib JDK 17
- How to run: `./gradlew simulateJava`
- AdvantageScope: subscribe to `Simulation/RobotPose` (Pose2d) and
  `Simulation/{{Name}}Poses` (Pose3d array)
- Physics timing: arena at 20ms in `Robot.simulationPeriodic()`,
  CTRE motor sim at 5ms in Swerve Notifier
- `MapleSimSwerveDrivetrain.java` is project-local, not a library class
- No `regulateModuleConstantsForSimulation()` - that method does not exist in 0.4.0-beta

---

## Step 9: Confirm and Summary

Tell the user which files were written and remind them:
- Run `./gradlew build` to verify
- Robot spawns at (2.0, 4.025) - inside the blue alliance half
- `Simulation/RobotPose` = MapleSim ground-truth pose
- `Simulation/{{Name}}Poses` = Pose3d array of game piece positions
- Robot.java should use the RobotContainer-owned drivetrain, not a separate StateMachine instance
- StateMachine.java does NOT need a static block - `regulateModuleConstantsForSimulation()` does not exist

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
