// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.Utils;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.vision.LimelightVision;
import frc.powerlib.health.HealthChecks;
import frc.robot.Constants;

public class Vision extends SubsystemBase implements AutoCloseable {
  private final Swerve drivetrain;
  private final LimelightVision limelights;
  private boolean shouldUpdatePose = true;
  private LimelightVision.Measurement lastMeasurement;
  private double lastAppliedTimestamp = Double.NEGATIVE_INFINITY;

  public Vision(Swerve drivetrain) {
    this.drivetrain = drivetrain;
    limelights = new LimelightVision(Constants.Vision.CONFIG, Constants.Vision.HEADING_CONFIG,
        Constants.Vision.LIMELIGHT_NAMES);
  }

  /** Seed the pose from the last accepted frame, only while disabled and still fresh. */
  public boolean seedFromFreshVision() {
    if (!DriverStation.isDisabled() || lastMeasurement == null) return false;
    double age = Timer.getFPGATimestamp() - lastMeasurement.timestampSeconds();
    var pose = lastMeasurement.pose();
    if (!HealthChecks.isFresh(age, Constants.Vision.CONFIG.maxMeasurementAgeSeconds())
        || !HealthChecks.finitePose(pose)) return false;
    drivetrain.resetPose(pose);
    return true;
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
        drivetrain.getPigeon2().getRoll().getValueAsDouble(),
        Math.toDegrees(state.Speeds.omegaRadiansPerSecond));
    estimate.ifPresent(measurement -> lastMeasurement = measurement);
    // Continue reading while disabled so those cached frames are not applied after enabling.
    applyMeasurements(estimate.orElse(null), limelights.getHeadingMeasurement().orElse(null));
  }

  private void applyMeasurements(LimelightVision.Measurement position,
      LimelightVision.HeadingMeasurement heading) {
    boolean correctedHeading = false;
    if (shouldUpdatePose && DriverStation.isEnabled()) {
      // Feed delayed measurements in capture order so an older frame cannot undo a newer one.
      boolean headingFirst = heading != null
          && (position == null || heading.timestampSeconds() <= position.timestampSeconds());
      if (headingFirst) correctedHeading = applyHeadingCorrection(heading);
      if (position != null) applyPositionCorrection(position);
      if (heading != null && !headingFirst) correctedHeading = applyHeadingCorrection(heading);
    }
    SignalLogger.writeBoolean("Vision/Heading/Accepted", correctedHeading);
  }

  private void applyPositionCorrection(LimelightVision.Measurement measurement) {
    if (measurement.timestampSeconds() < lastAppliedTimestamp) return;
    drivetrain.addVisionMeasurement(
        measurement.pose(), measurement.timestampSeconds(), measurement.standardDeviations());
    lastAppliedTimestamp = measurement.timestampSeconds();
  }

  private boolean applyHeadingCorrection(LimelightVision.HeadingMeasurement measurement) {
    if (DriverStation.isTest() || measurement.timestampSeconds() < lastAppliedTimestamp) return false;
    // Swerve's addVisionMeasurement wrapper accepts FPGA time; samplePoseAt needs CTRE time.
    var historicalPose = drivetrain.samplePoseAt(Utils.fpgaToCurrentTime(measurement.timestampSeconds()));
    if (historicalPose.isEmpty()) return false;
    SignalLogger.writeDouble("Vision/Heading/ErrorDegrees",
        measurement.pose().getRotation().minus(historicalPose.get().getRotation()).getDegrees(), "degrees");
    var correction = measurement.correctionPose(
        historicalPose.get(), Constants.Vision.HEADING_CONFIG.maxHeadingErrorDegrees());
    if (correction.isEmpty()) return false;
    drivetrain.addVisionMeasurement(
        correction.get(), measurement.timestampSeconds(), measurement.standardDeviations());
    lastAppliedTimestamp = measurement.timestampSeconds();
    return true;
  }

  @Override
  public void close() {
    CommandScheduler.getInstance().unregisterSubsystem(this);
    limelights.close();
  }
}
