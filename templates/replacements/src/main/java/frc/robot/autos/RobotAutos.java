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

    // Continuous sections: buildDrivePathCommand must drive all section.points() in one command
    // and settle at its endpoint. section.firstPointIndex() identifies settings by ordered leg.
    // The action between the sections remains a stop boundary, even if it finishes immediately.
    // For bounded intermediate crossings, configure PathProgress with WaypointHandoffConfig in
    // your path command and call reset(measuredStartingPosition) when that command initializes.
    // Endpoints must still use CompletionChecker; crossings never replace endpoint settling.
    // Optional CrossTrackController can steer from PathProgress.currentSegment() and the existing
    // braking speed budget. Apply ChassisMotionLimiter after correction; tune CrossTrackConfig on hardware.
    // Each PathWaypoint may use RotationTarget.NONE, fixed(heading), facePoint(fieldPoint, offset),
    // or live(pose -> heading). For example, drive toward pickupPoint while facing a separate hubPoint:
    // new PathWaypoint(pickupPoint, limits, arrival, RotationTarget.facePoint(hubPoint), timeoutSeconds).
    // Resolve enabled targets once per update; use that heading for PID, telemetry and endpoint settling.
    // All points/headings use the same field frame. A 180-degree offset faces the robot's rear at the point.
    // autoBuilder.addAuto("Blue continuous", edu.wpi.first.wpilibj.DriverStation.Alliance.Blue,
    //     () -> new frc.powerlib.auto.Auto("Blue continuous")
    //         .withPath(approachPoint, pickupPoint, shootingPoint)
    //         .toNextPoint().toNextPoint()
    //         .addCommand(() -> buildSpinUpCommand(robot))
    //         .toNextPoint()
    //         .addCommand(() -> buildShootCommand(robot))
    //         .buildContinuous(section -> buildDrivePathCommand(robot, section)));

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
