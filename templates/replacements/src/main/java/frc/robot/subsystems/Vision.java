// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.Utils;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.health.HealthChecks;
import frc.powerlib.vision.LimelightVision;
import frc.powerlib.vision.VisionHeadingInitializer;
import frc.robot.Constants;

public class Vision extends SubsystemBase implements AutoCloseable {
  private final Swerve drivetrain;
  private final LimelightVision limelights;
  private boolean shouldUpdatePose = true;
  private LimelightVision.Measurement lastMeasurement;
  private LimelightVision.HeadingMeasurement lastHeadingMeasurement;
  private double lastAppliedTimestamp = Double.NEGATIVE_INFINITY;
  private double lastFusedPositionTimestamp = Double.NEGATIVE_INFINITY;
  private double lastAppliedHeadingTimestamp = Double.NEGATIVE_INFINITY;
  private String headingStatus = "Waiting for independent heading";
  private final VisionHeadingInitializer headingInitializer =
      new VisionHeadingInitializer(Constants.Vision.HEADING_INITIALIZATION_CONFIG,
          Constants.Vision.HEADING_CONFIG.maxMeasurementAgeSeconds());

  public Vision(Swerve drivetrain) {
    this.drivetrain = drivetrain;
    limelights = new LimelightVision(Constants.Vision.CONFIG, Constants.Vision.HEADING_CONFIG,
        Constants.Vision.LIMELIGHT_NAMES);
  }

  public boolean hasFreshMeasurement() {
    return lastMeasurement != null && HealthChecks.finitePose(lastMeasurement.pose())
        && HealthChecks.isFresh(Timer.getFPGATimestamp() - lastMeasurement.timestampSeconds(),
            Constants.Vision.CONFIG.maxMeasurementAgeSeconds());
  }

  /** Capture timestamp of the latest fused position frame, in FPGA seconds; -infinity before fusion. */
  public double getLastAppliedPositionTimestampSeconds() { return lastFusedPositionTimestamp; }

  /** Seed the pose from the last accepted frame, only while disabled and still fresh. */
  public boolean seedFromFreshVision() {
    if (!DriverStation.isDisabled() || !hasFreshMeasurement()) return false;
    var pose = lastMeasurement.pose();
    // MT2 yaw depends on the orientation sent to the camera and cannot independently fix drift.
    var rotation = drivetrain.getState().Pose.getRotation();
    if (hasFreshHeading()) rotation = lastHeadingMeasurement.pose().getRotation();
    if (!Double.isFinite(rotation.getRadians())) return false;
    drivetrain.resetPose(new Pose2d(pose.getTranslation(), rotation));
    // Do not replay camera frames captured before this manual reset.
    lastAppliedTimestamp = Timer.getFPGATimestamp();
    lastAppliedHeadingTimestamp = lastAppliedTimestamp;
    headingInitializer.reset();
    return true;
  }

  public boolean hasFreshHeading() {
    return lastHeadingMeasurement != null && HealthChecks.finitePose(lastHeadingMeasurement.pose())
        && HealthChecks.isFresh(Timer.getFPGATimestamp() - lastHeadingMeasurement.timestampSeconds(),
            Constants.Vision.HEADING_CONFIG.maxMeasurementAgeSeconds());
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
    // Heading initialization needs fresh independent heading while disabled.
    limelights.setThrottle(DriverStation.isDisabled()
        && !(shouldUpdatePose && Constants.Vision.HEADING_INITIALIZATION_CONFIG.enabled()));
    var state = drivetrain.getState();
    var estimate = limelights.update(
        state.Pose.getRotation().getDegrees(),
        drivetrain.getPigeon2().getPitch().getValueAsDouble(),
        drivetrain.getPigeon2().getRoll().getValueAsDouble(),
        Math.toDegrees(state.Speeds.omegaRadiansPerSecond), DriverStation.isDisabled());
    estimate.ifPresent(measurement -> lastMeasurement = measurement);
    limelights.getHeadingMeasurement().ifPresent(measurement -> lastHeadingMeasurement = measurement);
    // Continue reading while disabled so those cached frames are not applied after enabling.
    applyMeasurements(estimate.orElse(null), limelights.getHeadingMeasurement().orElse(null));
  }

  private void applyMeasurements(LimelightVision.Measurement position,
      LimelightVision.HeadingMeasurement heading) {
    boolean correctedHeading = false;
    headingStatus = !shouldUpdatePose ? "Vision corrections disabled"
        : !DriverStation.isEnabled() ? "Robot disabled"
        : heading == null ? "No fresh reliable multi-tag heading" : "Heading candidate";
    if (shouldUpdatePose && DriverStation.isDisabled()
        && Constants.Vision.HEADING_INITIALIZATION_CONFIG.enabled()) {
      correctedHeading = initializeHeading(heading, Timer.getFPGATimestamp());
    } else {
      headingInitializer.reset();
    }
    if (shouldUpdatePose && DriverStation.isEnabled()) {
      // Feed delayed measurements in capture order so an older frame cannot undo a newer one.
      boolean headingFirst = heading != null
          && (position == null || heading.timestampSeconds() <= position.timestampSeconds());
      if (headingFirst) correctedHeading = applyHeadingCorrection(heading);
      if (position != null) applyPositionCorrection(position);
      if (heading != null && !headingFirst) correctedHeading = applyHeadingCorrection(heading);
    }
    SignalLogger.writeBoolean("Vision/Heading/Accepted", correctedHeading);
    SignalLogger.writeString("Vision/Heading/Status", headingStatus);
    SignalLogger.writeDouble("Vision/Heading/PigeonYawDegrees",
        drivetrain.getPigeon2().getYaw().getValueAsDouble(), "degrees");
    SignalLogger.writeDouble("Vision/Heading/EstimatedDegrees",
        drivetrain.getState().Pose.getRotation().getDegrees(), "degrees");
  }

  private boolean initializeHeading(LimelightVision.HeadingMeasurement measurement, double now) {
    if (!DriverStation.isDisabled() || !shouldUpdatePose) {
      headingInitializer.reset();
      headingStatus = "Automatic initialization requires disabled robot and enabled vision";
      return false;
    }
    if (!HealthChecks.driveHealthy(drivetrain,
        Constants.Vision.HEADING_INITIALIZATION_CONFIG.maxSignalAgeSeconds())) {
      headingInitializer.reset();
      headingStatus = "Waiting for fresh drivetrain feedback";
      return false;
    }
    var speeds = drivetrain.getState().Speeds;
    var rotation = headingInitializer.update(measurement, now,
        Math.hypot(speeds.vxMetersPerSecond, speeds.vyMetersPerSecond),
        Math.toDegrees(speeds.omegaRadiansPerSecond));
    headingStatus = headingInitializer.status();
    if (rotation.isEmpty()) return false;
    // Establish absolute field heading without changing X/Y or resetting raw gyro yaw.
    drivetrain.resetRotation(rotation.get());
    lastAppliedTimestamp = now;
    lastAppliedHeadingTimestamp = now;
    SignalLogger.writeString("Robot/Control/Action", "MT1 heading initialized automatically");
    return true;
  }

  private void applyPositionCorrection(LimelightVision.Measurement measurement) {
    if (measurement.timestampSeconds() < lastAppliedTimestamp) return;
    drivetrain.addVisionMeasurement(
        measurement.pose(), measurement.timestampSeconds(),
        measurement.standardDeviations());
    lastAppliedTimestamp = measurement.timestampSeconds();
    lastFusedPositionTimestamp = measurement.timestampSeconds();
  }

  private boolean applyHeadingCorrection(LimelightVision.HeadingMeasurement measurement) {
    if (DriverStation.isTest()) { headingStatus = "Test mode"; return false; }
    if (measurement.timestampSeconds() <= lastAppliedHeadingTimestamp) {
      headingStatus = "Repeated or out-of-order heading"; return false;
    }
    lastAppliedHeadingTimestamp = measurement.timestampSeconds();
    // Swerve's addVisionMeasurement wrapper accepts FPGA time; samplePoseAt needs CTRE time.
    var historicalPose = drivetrain.samplePoseAt(Utils.fpgaToCurrentTime(measurement.timestampSeconds()));
    if (historicalPose.isEmpty()) { headingStatus = "Capture pose unavailable"; return false; }
    SignalLogger.writeDouble("Vision/Heading/ErrorDegrees",
        measurement.pose().getRotation().minus(historicalPose.get().getRotation()).getDegrees(), "degrees");
    // MT1 can arrive later than MT2. Fuse at the latest applied time, carrying forward
    // the capture-time error through intervening rotation, so neither stream undoes the other.
    double fusionTimestamp = Math.max(lastAppliedTimestamp, measurement.timestampSeconds());
    var fusionPose = drivetrain.samplePoseAt(Utils.fpgaToCurrentTime(fusionTimestamp));
    if (fusionPose.isEmpty()) { headingStatus = "Fusion pose unavailable"; return false; }
    var correction = measurement.correctionPose(historicalPose.get(), fusionPose.get(),
        Constants.Vision.HEADING_CONFIG.maxHeadingErrorDegrees());
    if (correction.isEmpty()) { headingStatus = "Heading error exceeds limit"; return false; }
    drivetrain.addVisionMeasurement(
        correction.get(), fusionTimestamp, measurement.standardDeviations());
    lastAppliedTimestamp = fusionTimestamp;
    headingStatus = "Independent heading applied";
    return true;
  }

  @Override
  public void close() {
    CommandScheduler.getInstance().unregisterSubsystem(this);
    limelights.close();
  }
}
