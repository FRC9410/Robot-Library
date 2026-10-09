package frc.robot.autos;

import frc.powerlib.auto.AutoBuilder;
import frc.robot.subsystems.StateMachine;

/** Defines this robot's autonomous routines. The installer preserves this file once it exists. */
public final class RobotAutos {
  private RobotAutos() {}

  public static void register(AutoBuilder autoBuilder, StateMachine robot) {
    // Register command factories here; each factory must create a fresh command for every run.
    // autoBuilder.addAuto("My Auto", () -> buildMyAuto(robot));

    // For waypoint autos, configure AutoBuilder with your drive-command factory in RobotContainer.
    // Replace pickupPoint/shootingPoint with your Pose2d destinations and provide the action factories.
    // Direct destinations:
    // autoBuilder.addAuto(new frc.powerlib.auto.Auto("Blue direct")
    //     .withAlliance(edu.wpi.first.wpilibj.DriverStation.Alliance.Blue)
    //     .addCommand(() -> buildIntakeCommand(robot))
    //     .addDriveToPoint(pickupPoint)
    //     .addCommand(() -> buildSpinUpCommand(robot))
    //     .addDriveToPoint(shootingPoint)
    //     .addCommand(() -> buildShootCommand(robot)));

    // Path cursor, with the same command order:
    // autoBuilder.addAuto(new frc.powerlib.auto.Auto("Blue path")
    //     .withAlliance(edu.wpi.first.wpilibj.DriverStation.Alliance.Blue)
    //     .withPath(pickupPoint, shootingPoint)
    //     .addCommand(() -> buildIntakeCommand(robot))
    //     .toNextPoint()
    //     .addCommand(() -> buildSpinUpCommand(robot))
    //     .toNextPoint()
    //     .addCommand(() -> buildShootCommand(robot)));
  }
}
