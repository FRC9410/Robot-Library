# Swerve.java Sim Thread Replacement Template

---

## 1. Add field declarations

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

```java
private void startSimThread() {
    mapleSimSwerveDrivetrain = new MapleSimSwerveDrivetrain(
        kSimLoopPeriod,
        {{ROBOT_WEIGHT_LBS}},
        {{BUMPER_LENGTH_IN}},
        {{BUMPER_WIDTH_IN}},
        {{DRIVE_MOTOR_EXPRESSION}},
        {{STEER_MOTOR_EXPRESSION}},
        {{WHEEL_COF}},
        getModuleLocations(),
        getPigeon2(),
        getModules(),
        // These two suppliers fix MapleSim heading divergence after rotation
        () -> getState().Speeds,
        () -> getState().Pose.getRotation(),
        TunerConstants.FrontLeft,
        TunerConstants.FrontRight,
        TunerConstants.BackLeft,
        TunerConstants.BackRight);

    // 5ms notifier — only CTRE motor sim, NOT SimulatedArena
    // SimulatedArena.simulationPeriodic() runs in Robot.simulationPeriodic() at 20ms
    m_simNotifier = new Notifier(mapleSimSwerveDrivetrain::update);
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```

---

## 3. Add simulationPeriodic() method

This is called from `Robot.simulationPeriodic()` at 20ms — the correct rate for
`SimulatedArena.simulationPeriodic()`. Do NOT call this from the 5ms Notifier.

```java
public void simulationPeriodic() {
    if (mapleSimSwerveDrivetrain != null) {
        mapleSimSwerveDrivetrain.simulationPeriodic();
    }
}
```

---

## 4. Add resetPose() override

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

---

## 5. Add sim pose publishing to periodic()

At the end of `periodic()`:

```java
if (mapleSimSwerveDrivetrain != null) {
    simPosePublisher.set(mapleSimSwerveDrivetrain.getSimulatedDriveTrainPose());
}
```

---

## 6. Imports to ADD

```java
import frc.robot.utils.simulation.MapleSimSwerveDrivetrain;
import edu.wpi.first.math.system.plant.DCMotor;
import edu.wpi.first.networktables.StructPublisher;
import edu.wpi.first.wpilibj.Timer;
```

## CRITICAL: Imports NOT to add

`import static edu.wpi.first.units.Units.*` at line 3 already covers everything.
Do NOT add these — they cause duplicate import compiler warnings:

```java
// DO NOT ADD:
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

Kraken X60 drive, Kraken X44 steer, 115 lbs, 30x28 bumper, COF 1.2:

```java
private void startSimThread() {
    mapleSimSwerveDrivetrain = new MapleSimSwerveDrivetrain(
        kSimLoopPeriod,
        115,
        30,
        28,
        DCMotor.getKrakenX60(1),
        DCMotor.getKrakenX44(1),
        1.2,
        getModuleLocations(),
        getPigeon2(),
        getModules(),
        () -> getState().Speeds,
        () -> getState().Pose.getRotation(),
        TunerConstants.FrontLeft,
        TunerConstants.FrontRight,
        TunerConstants.BackLeft,
        TunerConstants.BackRight);

    m_simNotifier = new Notifier(mapleSimSwerveDrivetrain::update);
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```
