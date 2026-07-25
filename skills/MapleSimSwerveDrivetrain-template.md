# MapleSimSwerveDrivetrain.java Template

This class is project-local. There is no MapleSim vendordep class named
`org.ironmaple.simulation.drivesims.MapleSimSwerveDrivetrain`.

Do not create a second CTRE `SimSwerveDrivetrain` here. The CTRE base drivetrain already owns
its internal motor/encoder sim and `Swerve.startSimThread()` calls `updateSimState()`.

## Physics Timing

- CTRE motor sim: 5 ms Notifier in `Swerve.startSimThread()`.
- MapleSim arena physics: 20 ms `Robot.simulationPeriodic()`.
- `SimulatedArena.simulationPeriodic()` runs internal sub-ticks, so do not call it from the 5 ms Notifier.

## Full File Template

```java
package frc.robot.utils.simulation;

import static edu.wpi.first.units.Units.*;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.math.system.plant.DCMotor;
import java.util.function.Supplier;
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.COTS;
import org.ironmaple.simulation.drivesims.SwerveDriveSimulation;
import org.ironmaple.simulation.drivesims.configs.DriveTrainSimulationConfig;
import org.ironmaple.simulation.drivesims.configs.SwerveModuleSimulationConfig;

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

    DriveTrainSimulationConfig config =
        DriveTrainSimulationConfig.Default()
            .withRobotMass(Pounds.of({{ROBOT_WEIGHT_LBS}}))
            .withBumperSize(Inches.of({{BUMPER_LENGTH_IN}}), Inches.of({{BUMPER_WIDTH_IN}}))
            .withGyro(COTS.ofPigeon2())
            .withSwerveModule(
                new SwerveModuleSimulationConfig(
                    {{DRIVE_MOTOR_EXPRESSION}},
                    {{STEER_MOTOR_EXPRESSION}},
                    {{DRIVE_GEAR_RATIO_VALUE}},
                    {{STEER_GEAR_RATIO_VALUE}},
                    Volts.of({{DRIVE_FRICTION_VOLTAGE}}),
                    Volts.of({{STEER_FRICTION_VOLTAGE}}),
                    Meters.of(0.0508),
                    KilogramSquareMeters.of({{STEER_INERTIA_VALUE}}),
                    {{WHEEL_COF}}));

    mapleSimDrive =
        new SwerveDriveSimulation(config, new Pose2d(2.0, 4.025, new Rotation2d(0)));
    mapleSimDrive.setLinearDamping(0);
    mapleSimDrive.setAngularDamping(0);
    SimulatedArena.getInstance().addDriveTrainSimulation(mapleSimDrive);
  }

  public void simulationPeriodic() {
    Rotation2d heading = headingSupplier.get();
    Pose2d currentPose = mapleSimDrive.getSimulatedDriveTrainPose();
    mapleSimDrive.setSimulationWorldPose(new Pose2d(currentPose.getTranslation(), heading));

    ChassisSpeeds fieldRelative =
        ChassisSpeeds.fromRobotRelativeSpeeds(robotRelativeSpeedsSupplier.get(), heading);
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
