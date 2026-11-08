package frc.robot.helpers;

import frc.robot.subsystems.StateMachine;

/** Custom conditions available to Auto Builder through StateMachine.checks. */
public final class RobotChecks {
  private final StateMachine robot;

  public RobotChecks(StateMachine robot) {
    this.robot = robot;
  }

  // Add public boolean methods with no arguments here. Use robot to read current robot data.
  // Example method body: return robot.drivetrain.getState().Pose.getX() >= 4.0;
}
