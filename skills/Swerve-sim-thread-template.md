# Swerve.java Sim Thread Replacement Template

All changes needed to wire MapleSim into the existing PowerLib Swerve.java.

---

## 1. Add field declarations near the top of the Swerve class

Find:
```java
private Notifier m_simNotifier = null;
private double m_lastSimTime;
```

Replace with:
```java
private Notifier m_simNotifier = null;
private double m_lastSimTime;
private MapleSimSwerveDrivetrain mapleSimSwerveDrivetrain = null;
private final StructPublisher<Pose2d> simPosePublisher =
    NetworkTableInstance.getDefault()
        .getStructTopic("Simulation/RobotPose", Pose2d.struct)
        .publish();
```

---

## 2. Replace startSimThread() entirely

Remove the old method and replace with:

```java
private void startSimThread() {
    mapleSimSwerveDrivetrain = new MapleSimSwerveDrivetrain(
        Seconds.of(kSimLoopPeriod),
        Pounds.of({{ROBOT_WEIGHT_LBS}}),
        Inches.of({{BUMPER_LENGTH_IN}}),
        Inches.of({{BUMPER_WIDTH_IN}}),
        {{DRIVE_MOTOR_EXPRESSION}},
        {{STEER_MOTOR_EXPRESSION}},
        {{WHEEL_COF}},
        getModuleLocations(),
        getPigeon2(),
        getModules(),
        TunerConstants.FrontLeft,
        TunerConstants.FrontRight,
        TunerConstants.BackLeft,
        TunerConstants.BackRight);

    SimManager.initialize();

    // Only call mapleSimSwerveDrivetrain::update here.
    // MapleSimSwerveDrivetrain.update() already calls
    // SimulatedArena.getInstance().simulationPeriodic() internally.
    // Do NOT add SimManager.update() — it would double-tick the physics engine.
    m_simNotifier = new Notifier(mapleSimSwerveDrivetrain::update);
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```

---

## 3. Add resetPose() override

Add after the constructors, before periodic():

```java
@Override
public void resetPose(Pose2d pose) {
    if (mapleSimSwerveDrivetrain != null) {
        mapleSimSwerveDrivetrain.mapleSimDrive.setSimulationWorldPose(pose);
    }
    Timer.delay(0.05);
    super.resetPose(pose);
}
```

Also ensure this import exists:
```java
import edu.wpi.first.wpilibj.Timer;
```

---

## 4. Add sim pose publishing to periodic()

Inside `periodic()`, add at the end guarded by a null check:

```java
if (mapleSimSwerveDrivetrain != null) {
    simPosePublisher.set(
        mapleSimSwerveDrivetrain.mapleSimDrive.getSimulatedDriveTrainPose());
}
```

---

## 5. Imports to ADD to Swerve.java

```java
import org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain;
import frc.robot.utils.simulation.SimManager;
import edu.wpi.first.math.system.plant.DCMotor;
import edu.wpi.first.networktables.StructPublisher;
```

## CRITICAL: Imports NOT to add

Do NOT add any of these — `import static edu.wpi.first.units.Units.*` at line 3 already
covers them. Adding them again causes duplicate import compiler warnings:

```java
// DO NOT ADD THESE:
import static edu.wpi.first.units.Units.Seconds;
import static edu.wpi.first.units.Units.Pounds;
import static edu.wpi.first.units.Units.Inches;
```

---

## DCMotor Expression Reference

| User Choice     | Java Expression              |
|-----------------|------------------------------|
| Kraken X60      | `DCMotor.getKrakenX60(1)`    |
| Kraken X60 FOC  | `DCMotor.getKrakenX60Foc(1)` |
| Kraken X44      | `DCMotor.getKrakenX44(1)`    |
| Falcon 500      | `DCMotor.getFalcon500(1)`    |
| NEO             | `DCMotor.getNEO(1)`          |
| NEO 550         | `DCMotor.getNeo550(1)`       |

---

## Full startSimThread() Example

Kraken X60 drive, Kraken X44 steer, 115 lbs, 30x30 bumper, COF 1.2:

```java
private void startSimThread() {
    mapleSimSwerveDrivetrain = new MapleSimSwerveDrivetrain(
        Seconds.of(kSimLoopPeriod),
        Pounds.of(115),
        Inches.of(30),
        Inches.of(30),
        DCMotor.getKrakenX60(1),
        DCMotor.getKrakenX44(1),
        1.2,
        getModuleLocations(),
        getPigeon2(),
        getModules(),
        TunerConstants.FrontLeft,
        TunerConstants.FrontRight,
        TunerConstants.BackLeft,
        TunerConstants.BackRight);

    SimManager.initialize();

    m_simNotifier = new Notifier(mapleSimSwerveDrivetrain::update);
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```
