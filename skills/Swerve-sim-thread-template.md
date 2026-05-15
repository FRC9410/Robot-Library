# Swerve.java Sim Thread Replacement Template

This file contains the exact changes to make to `Swerve.java` to replace the basic WPILib
sim thread with `MapleSimSwerveDrivetrain`.

---

## 1. Add field declaration near the top of the Swerve class

Find the existing line:
```java
private Notifier m_simNotifier = null;
```

Replace the block (including `m_lastSimTime`) with:
```java
private Notifier m_simNotifier = null;
private double m_lastSimTime;
private MapleSimSwerveDrivetrain mapleSimSwerveDrivetrain = null;
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

    m_simNotifier = new Notifier(() -> {
        mapleSimSwerveDrivetrain.update();
        SimManager.update();
    });
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```

---

## 3. Add resetPose() override

Add this method to the Swerve class (after the existing constructors, before periodic()):

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

Also add the Timer import if not already present:
```java
import edu.wpi.first.wpilibj.Timer;
```

---

## 4. Add all required imports to Swerve.java

Add these imports at the top of the file alongside existing imports:

```java
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain;
import frc.robot.utils.simulation.SimManager;
import edu.wpi.first.math.system.plant.DCMotor;
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
| Falcon 500      | `DCMotor.getFalcon500(1)`    |
| NEO             | `DCMotor.getNEO(1)`          |
| NEO 550         | `DCMotor.getNeo550(1)`       |

---

## Full Example (Kraken X60 drive, Falcon 500 steer, 115 lbs, 30x30 bumper, COF 1.2)

```java
private void startSimThread() {
    mapleSimSwerveDrivetrain = new MapleSimSwerveDrivetrain(
        Seconds.of(kSimLoopPeriod),
        Pounds.of(115),
        Inches.of(30),
        Inches.of(30),
        DCMotor.getKrakenX60(1),
        DCMotor.getFalcon500(1),
        1.2,
        getModuleLocations(),
        getPigeon2(),
        getModules(),
        TunerConstants.FrontLeft,
        TunerConstants.FrontRight,
        TunerConstants.BackLeft,
        TunerConstants.BackRight);

    SimManager.initialize();

    m_simNotifier = new Notifier(() -> {
        mapleSimSwerveDrivetrain.update();
        SimManager.update();
    });
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```
