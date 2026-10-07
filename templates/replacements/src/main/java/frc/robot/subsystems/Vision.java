// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.vision.LimelightVision;
import frc.robot.Constants;

public class Vision extends SubsystemBase implements AutoCloseable {
  private final Swerve drivetrain;
  private final LimelightVision limelights;
  private boolean shouldUpdatePose = true;

  public Vision(Swerve drivetrain) {
    this.drivetrain = drivetrain;
    limelights = new LimelightVision(Constants.Vision.CONFIG, Constants.Vision.LIMELIGHT_NAMES);
  }

  /** Enable or disable vision corrections, for example from an autonomous path event. */
  public void setShouldUpdatePose(boolean shouldUpdate) {
    shouldUpdatePose = shouldUpdate;
  }

  public boolean shouldUpdatePose() {
    return shouldUpdatePose;
  }

  @Override
  public void periodic() {
    limelights.setThrottle(DriverStation.isDisabled());
    var state = drivetrain.getState();
    var estimate = limelights.update(
        state.Pose.getRotation().getDegrees(),
        drivetrain.getPigeon2().getPitch().getValueAsDouble(),
        drivetrain.getPigeon2().getRoll().getValueAsDouble());
    // Continue reading while disabled so those cached frames are not applied after enabling.
    if (shouldUpdatePose && DriverStation.isEnabled()) {
      estimate.ifPresent(measurement -> drivetrain.addVisionMeasurement(
          measurement.pose(), measurement.timestampSeconds(), measurement.standardDeviations()));
    }
  }

  @Override
  public void close() {
    CommandScheduler.getInstance().unregisterSubsystem(this);
    limelights.close();
  }
}
