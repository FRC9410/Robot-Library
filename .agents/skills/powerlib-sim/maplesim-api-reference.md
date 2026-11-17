# MapleSim 0.4.0-beta API Facts

Checked against the vendordep JAR. Read this before generating or changing any sim file.

## Classes that DO exist in the vendordep
- `org.ironmaple.simulation.SimulatedArena`
- `org.ironmaple.simulation.drivesims.SwerveDriveSimulation`
- `org.ironmaple.simulation.drivesims.SelfControlledSwerveDriveSimulation`
- `org.ironmaple.simulation.drivesims.AbstractDriveTrainSimulation`
- `org.ironmaple.simulation.drivesims.configs.DriveTrainSimulationConfig`
- `org.ironmaple.simulation.drivesims.configs.SwerveModuleSimulationConfig`
- `org.ironmaple.simulation.drivesims.COTS`
- `org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation`
- `org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation.GamePieceInfo` (nested record)

## Classes that DO NOT exist in the vendordep
- `org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain` - does NOT exist
- `org.ironmaple.simulation.drivesims.CTRESwerveDrivetrainSimulation` - does NOT exist
- There is NO `regulateModuleConstantsForSimulation()` method anywhere in the library

## Key API signatures (verified from source)

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

`SwerveModuleSimulationConfig` constructor - 9 parameters (verified via javap):
```java
new SwerveModuleSimulationConfig(
    DCMotor,           // drive motor
    DCMotor,           // steer motor
    double,            // drive gear ratio
    double,            // steer gear ratio
    Voltage,           // drive friction voltage  - use kDriveFrictionVoltage from TunerConstants
    Voltage,           // steer friction voltage  - use kSteerFrictionVoltage from TunerConstants
    Distance,          // wheel radius
    MomentOfInertia,   // steer MOI              - use kSteerInertia from TunerConstants
    double)            // wheel COF
```

Do NOT use a 6-parameter form - it does not exist in 0.4.0-beta.

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
`import static edu.wpi.first.units.Units.*` - do NOT add explicit measure imports.

`GamePieceInfo` record - 7 fields, not 4:
```java
public record GamePieceInfo(
    String type,
    Convex shape,           // dyn4j Convex - use new Circle(radiusMeters) or new Rectangle(l, w)
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

## CTRE internal sim - do NOT duplicate

`SwerveDrivetrain` (the CTRE base class that `Swerve` extends) already creates an internal
`SimSwerveDrivetrain` field (`m_simDrive`) and calls `m_simDrive.update(...)` inside
`updateSimState(double dtSeconds, double supplyVoltage)`. The existing 5ms Notifier in
`Swerve.java` already calls `updateSimState()` every loop.

Do NOT create a second `SimSwerveDrivetrain` in `MapleSimSwerveDrivetrain.java`. It would
double-simulate all CTRE motor states. The wrapper only owns `SwerveDriveSimulation`.

## WheelRadius type

`TunerConstants.FrontLeft.WheelRadius` is declared as `Distance` (e.g. `Inches.of(2)`),
not a raw `double`. Do NOT wrap it in `Meters.of(...)` - that would fail to compile since
`Meters.of()` takes a `double` not a `Distance`.

Instead, hardcode the wheel radius from the known value in TunerConstants:
```java
Meters.of(0.0508)  // 2 inches - matches TunerConstants kWheelRadius = Inches.of(2)
```

Or read the double value:
```java
TunerConstants.FrontLeft.WheelRadius.in(Meters)
```
