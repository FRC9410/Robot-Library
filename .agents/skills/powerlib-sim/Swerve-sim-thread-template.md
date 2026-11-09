# Swerve.java Sim Thread Template

Use this when updating `src/main/java/frc/robot/subsystems/Swerve.java` for MapleSim.

## 1. Fields

Find:

```java
private Notifier m_simNotifier = null;
```

Add or ensure:

```java
private MapleSimSwerveDrivetrain mapleSimSwerveDrivetrain = null;
private final StructPublisher<Pose2d> simPosePublisher =
    NetworkTableInstance.getDefault()
        .getStructTopic("Simulation/RobotPose", Pose2d.struct)
        .publish();
```

## 2. startSimThread()

The 5 ms Notifier should only run CTRE motor sim through `updateSimState()`.
MapleSim arena physics runs from `Robot.simulationPeriodic()` at 20 ms.

```java
private void startSimThread() {
    // Set this before the Notifier fires. Left at 0.0, the first tick's deltaTime equals the
    // robot's whole uptime.
    m_lastSimTime = Utils.getCurrentTimeSeconds();

    // 3 parameters only. The CTRE base class handles motor and encoder sim itself.

    mapleSimSwerveDrivetrain =
        new MapleSimSwerveDrivetrain(
            getModuleLocations(), () -> getState().Speeds, () -> getState().Pose.getRotation());

    // Align CTRE odometry with MapleSim's non-origin starting pose.
    super.resetPose(mapleSimSwerveDrivetrain.getSimulatedDriveTrainPose());

    SimManager.initialize();

    // This Notifier only runs CTRE motor sim. Don't add a second Notifier, and don't call
    // SimulatedArena here.
    if (m_simNotifier != null) {
      m_simNotifier.close();
    }
    m_simNotifier =
        new Notifier(
            () -> {
              final double currentTime = Utils.getCurrentTimeSeconds();
              double deltaTime = currentTime - m_lastSimTime;
              m_lastSimTime = currentTime;
              updateSimState(deltaTime, RobotController.getBatteryVoltage());
            });
    m_simNotifier.startPeriodic(kSimLoopPeriod);
}
```

## 3. simulationPeriodic()

```java
public void simulationPeriodic() {
    if (mapleSimSwerveDrivetrain != null) {
        mapleSimSwerveDrivetrain.simulationPeriodic();
    }
}
```

## 4. resetPose()

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

## 5. periodic()

Add near the end of `periodic()`:

```java
if (mapleSimSwerveDrivetrain != null) {
    simPosePublisher.set(mapleSimSwerveDrivetrain.getSimulatedDriveTrainPose());
}
```

## 6. Imports

Only add imports that are not already present:

```java
import edu.wpi.first.networktables.StructPublisher;
import edu.wpi.first.wpilibj.Timer;
import frc.robot.utils.simulation.MapleSimSwerveDrivetrain;
import frc.robot.utils.simulation.SimManager;
```

Do not add explicit `Seconds`, `Pounds`, or `Inches` static imports if `Units.*` is already present.
