# MapleSimSwerveDrivetrain.java Template

## Class Name Correction

There is NO class named `CTRESwerveDrivetrainSimulation` in maple-sim 0.4.0-beta.

The two classes you need are:
- `org.ironmaple.simulation.drivesims.SwerveDriveSimulation` — MapleSim physics engine
- `com.ctre.phoenix6.swerve.SimSwerveDrivetrain` — CTRE motor/encoder state sim

Both are needed. They serve different purposes.

---

## Physics Timing — Critical

`SimulatedArena.simulationPeriodic()` runs 5 internal sub-ticks per call.

- Called at 200 Hz (5ms Notifier): 1000 sub-ticks/second = 40x real time. Robot teleports.
- Called at 50 Hz (20ms Robot.simulationPeriodic()): 250 sub-ticks/second = correct.

CORRECT split:
- `update()` — 5ms Notifier — only `ctreSimDrivetrain.update(...)` (CTRE motor sim)
- `simulationPeriodic()` — Robot.simulationPeriodic() at 20ms — `SimulatedArena.getInstance().simulationPeriodic()`

---

## Full File Template

```java
package frc.robot.utils.simulation;

import com.ctre.phoenix6.hardware.Pigeon2;
import com.ctre.phoenix6.sim.Pigeon2SimState;
import com.ctre.phoenix6.swerve.SimSwerveDrivetrain;
import com.ctre.phoenix6.swerve.SwerveModule;
import com.ctre.phoenix6.swerve.SwerveModuleConstants;
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.SwerveDriveSimulation;
import org.ironmaple.simulation.drivesims.configs.DriveTrainSimulationConfig;
import org.ironmaple.simulation.drivesims.configs.SwerveModuleSimulationConfig;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.math.system.plant.DCMotor;
import edu.wpi.first.wpilibj.RobotController;
import java.util.function.Supplier;
import static edu.wpi.first.units.Units.*;

public class MapleSimSwerveDrivetrain {

    public final SwerveDriveSimulation mapleSimDrive;
    private final SimSwerveDrivetrain ctreSimDrivetrain;
    private final SwerveModule<?, ?, ?>[] modules;
    private final double simLoopPeriod;
    private final Supplier<ChassisSpeeds> robotRelativeSpeedsSupplier;
    private final Supplier<Rotation2d> headingSupplier;

    public MapleSimSwerveDrivetrain(
            double simLoopPeriod,
            double robotWeightPounds,
            double bumperLengthInches,
            double bumperWidthInches,
            DCMotor driveMotor,
            DCMotor steerMotor,
            double wheelCOF,
            Translation2d[] moduleLocations,
            Pigeon2 pigeon2,
            SwerveModule<?, ?, ?>[] modules,
            Supplier<ChassisSpeeds> robotRelativeSpeedsSupplier,
            Supplier<Rotation2d> headingSupplier,
            SwerveModuleConstants<?, ?, ?>... moduleConstants) {

        this.simLoopPeriod = simLoopPeriod;
        this.modules = modules;
        this.robotRelativeSpeedsSupplier = robotRelativeSpeedsSupplier;
        this.headingSupplier = headingSupplier;

        // Build MapleSim drivetrain config
        DriveTrainSimulationConfig config = DriveTrainSimulationConfig.Default()
            .withRobotMass(Pounds.of(robotWeightPounds))
            .withBumperSize(Inches.of(bumperLengthInches), Inches.of(bumperWidthInches))
            .withSwerveModule(new SwerveModuleSimulationConfig(
                driveMotor,
                steerMotor,
                moduleConstants[0].DriveMotorGearRatio,
                moduleConstants[0].SteerMotorGearRatio,
                // WheelRadius is a raw double (meters) — wrap as Distance
                Meters.of(moduleConstants[0].WheelRadius),
                wheelCOF));

        mapleSimDrive = new SwerveDriveSimulation(config,
            // Initial spawn pose — NOT new Pose2d() which is outside the field
            new Pose2d(2.0, 4.025, new Rotation2d(0)));

        // Zero damping — default of 1.4 fights setRobotSpeeds() and makes robot barely move
        mapleSimDrive.setLinearDamping(0);
        mapleSimDrive.setAngularDamping(0);

        SimulatedArena.getInstance().addDriveTrainSimulation(mapleSimDrive);

        // CTRE sim for motor/encoder state updates
        Pigeon2SimState pigeonSim = pigeon2.getSimState();
        ctreSimDrivetrain = new SimSwerveDrivetrain(moduleLocations, pigeonSim, moduleConstants);
    }

    /**
     * Called from the 5ms Notifier in Swerve.startSimThread().
     * Only updates CTRE motor/encoder sim state. Does NOT tick SimulatedArena.
     */
    public void update() {
        ctreSimDrivetrain.update(simLoopPeriod, RobotController.getBatteryVoltage(), modules);
    }

    /**
     * Called from Robot.simulationPeriodic() at 20ms.
     * Ticks SimulatedArena physics (5 sub-ticks = 250/second at 50Hz = correct real time).
     * Uses CTRE heading to prevent MapleSim heading from diverging after rotation.
     * Applies speeds both before and after the tick so damping cannot cancel them.
     */
    public void simulationPeriodic() {
        // Use CTRE heading — MapleSim's internal heading diverges after rotation
        Rotation2d heading = headingSupplier.get();
        Pose2d currentPose = mapleSimDrive.getSimulatedDriveTrainPose();

        // Sync MapleSim pose to CTRE heading
        mapleSimDrive.setSimulationWorldPose(
            new Pose2d(currentPose.getTranslation(), heading));

        // setRobotSpeeds() takes FIELD-RELATIVE speeds, not robot-relative
        ChassisSpeeds fieldRelative = ChassisSpeeds.fromRobotRelativeSpeeds(
            robotRelativeSpeedsSupplier.get(), heading);

        // Apply before tick so physics has the correct velocity
        mapleSimDrive.setRobotSpeeds(fieldRelative);
        SimulatedArena.getInstance().simulationPeriodic();
        // Apply again after tick so the arena tick does not zero them out
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
