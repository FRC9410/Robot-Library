// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.Utils;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotBase;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.health.HealthChecks;
import frc.powerlib.vision.LimelightVision;
import frc.powerlib.vision.VisionHeadingInitializer;
import frc.powerlib.vision.VisionHeadingReadiness;
import frc.powerlib.vision.VisionHeadingSelector;
import frc.powerlib.vision.VisionMeasurementFusion;
import frc.powerlib.vision.VisionPoseFilter;
import frc.robot.Constants;
import java.util.List;
import java.util.Objects;

public class Vision extends SubsystemBase implements AutoCloseable {
  private static final double HEADING_AGREEMENT_DEGREES = 5;
  private record DriveFeedback(Pose2d pose, double speed, double yawRate, boolean healthy) {}
  private final Swerve drivetrain;
  private final LimelightVision limelights;
  private final VisionPoseFilter poseFilter =
      new VisionPoseFilter(Constants.Vision.POSE_FILTER_CONFIG, Constants.Vision.CONFIG.maxMeasurementAgeSeconds());
  private boolean shouldUpdatePose = true;
  private LimelightVision.Measurement lastMeasurement;
  private LimelightVision.Measurement lastAcceptedMeasurement;
  private boolean headingEstablished;
  private final VisionHeadingInitializationConfig initializationConfig;
  private boolean awaitingOrientationPublication;
  private long observedPoseResetVersion;
  private final VisionHeadingReadiness headingReadiness;
  private LimelightVision.HeadingMeasurement lastHeadingMeasurement;
  private final VisionMeasurementFusion fusion;
  private final VisionHeadingSelector headingSelector;
  private String headingStatus = "Waiting for independent heading";
  private final VisionHeadingInitializer headingInitializer;

  private final VisionHeadingInitializer stationaryHeadingInitializer;
  public Vision(Swerve drivetrain) {
    this(drivetrain, Constants.Vision.HEADING_INITIALIZATION_CONFIG);
  }

  Vision(Swerve drivetrain, VisionHeadingInitializationConfig initializationConfig) {
    this.drivetrain = Objects.requireNonNull(drivetrain);
    this.initializationConfig = Objects.requireNonNull(initializationConfig);
    headingEstablished = !initializationConfig.enabled();
    double headingMaxAge = Constants.Vision.HEADING_CONFIG.maxMeasurementAgeSeconds();
    headingReadiness = new VisionHeadingReadiness(initializationConfig, headingMaxAge, HEADING_AGREEMENT_DEGREES);
    headingSelector = new VisionHeadingSelector(initializationConfig, headingMaxAge);
    headingInitializer = new VisionHeadingInitializer(initializationConfig, headingMaxAge);
    stationaryHeadingInitializer = new VisionHeadingInitializer(initializationConfig, headingMaxAge);
    observedPoseResetVersion = drivetrain.getPoseResetVersion();
    fusion = new VisionMeasurementFusion(Constants.Vision.CONFIG.maxMeasurementAgeSeconds(),
        timestamp -> drivetrain.samplePoseAt(Utils.fpgaToCurrentTime(timestamp)), drivetrain::addVisionMeasurement);
    limelights = new LimelightVision(Constants.Vision.CONFIG, Constants.Vision.HEADING_CONFIG,
        Constants.Vision.LIMELIGHT_NAMES);
    if (Constants.Vision.LIMELIGHT_IMU_ASSIST_ENABLED) limelights.enableIMUAssist();
  }

  /** A plausible manual-seed candidate; this does not imply automatic fusion accepted it. */
  public boolean hasFreshMeasurement() {
    return poseFilter.plausible(lastMeasurement, Timer.getFPGATimestamp());
  }

  /** A recent position frame actually applied to the estimator or explicitly seeded by the operator. */
  public boolean hasFreshAcceptedMeasurement() {
    return poseFilter.plausible(lastAcceptedMeasurement, Timer.getFPGATimestamp());
  }

  public boolean isHeadingEstablished() {
    return headingEstablished;
  }

  /** Seed the pose from the last plausible frame, only while disabled and still fresh. */
  public boolean seedFromFreshVision() {
    if (!DriverStation.isDisabled() || !hasFreshMeasurement()) return false;
    var measurement = lastMeasurement;
    var pose = measurement.pose();
    // MT2 yaw depends on the orientation sent to the camera and cannot independently fix drift.
    var rotation = drivetrain.getState().Pose.getRotation();
    if (hasFreshHeading()) rotation = lastHeadingMeasurement.pose().getRotation();
    if (!Double.isFinite(rotation.getRadians())) return false;
    drivetrain.resetPose(new Pose2d(pose.getTranslation(), rotation));
    headingSelector.reset();
    establishHeading(Timer.getFPGATimestamp());
    // Keep the operator-selected frame available until it expires; automatic fusion still honors the cutoff.
    lastMeasurement = measurement;
    lastAcceptedMeasurement = measurement;
    return true;
  }

  /** Manual blue-field +X heading reset, preserving position and discarding pre-reset camera frames. */
  public void zeroHeading() {
    if (!DriverStation.isDisabled()) return;
    drivetrain.resetRotation(Rotation2d.kZero);
    headingSelector.reset();
    establishHeading(Timer.getFPGATimestamp());
  }

  public boolean hasFreshHeading() {
    double now = Timer.getFPGATimestamp();
    return lastHeadingMeasurement != null && HealthChecks.finitePose(lastHeadingMeasurement.pose())
        && (lastHeadingMeasurement.tagCount() > 1 || lastHeadingMeasurement.reliableSingleTag(now))
        && poseFilter.captureAllowed(lastHeadingMeasurement.timestampSeconds(), now)
        && HealthChecks.isFresh(now - lastHeadingMeasurement.timestampSeconds(),
            Constants.Vision.HEADING_CONFIG.maxMeasurementAgeSeconds());
  }

  /** Enable or disable vision corrections, for example from an autonomous path event. */
  public void setShouldUpdatePose(boolean shouldUpdate) {
    if (shouldUpdatePose != shouldUpdate) {
      headingSelector.reset();
      resetHeadingEvidence();
      poseFilter.resetRecovery();
    }
    shouldUpdatePose = shouldUpdate;
  }

  public boolean shouldUpdatePose() {
    return shouldUpdatePose;
  }

  @Override
  public void periodic() {
    // Heading initialization needs fresh independent heading while disabled.
    limelights.setThrottle(false);
    double now = Timer.getFPGATimestamp();
    if (drivetrain.getPoseResetVersion() != observedPoseResetVersion) {
      // Includes autonomous pose seeds performed directly through the drivetrain.
      headingSelector.reset();
      establishHeading(now);
    }
    var state = drivetrain.getState();
    var pitch = drivetrain.getPigeon2().getPitch();
    var roll = drivetrain.getPigeon2().getRoll();
    boolean gyroHealthy = Double.isFinite(state.Pose.getRotation().getRadians()) && (RobotBase.isSimulation()
        || HealthChecks.signalHealthy(drivetrain.getPigeon2().getYaw(), Constants.Vision.POSE_FILTER_CONFIG.maxOrientationAgeSeconds())
            && HealthChecks.signalHealthy(pitch, Constants.Vision.POSE_FILTER_CONFIG.maxOrientationAgeSeconds())
            && HealthChecks.signalHealthy(roll, Constants.Vision.POSE_FILTER_CONFIG.maxOrientationAgeSeconds()));
    poseFilter.observe(now, pitch.getValueAsDouble(), roll.getValueAsDouble(), gyroHealthy);
    limelights.update(
        state.Pose.getRotation().getDegrees(),
        pitch.getValueAsDouble(), roll.getValueAsDouble(),
        Math.toDegrees(state.Speeds.omegaRadiansPerSecond), DriverStation.isDisabled()
          || initializationConfig.isStationary(Math.hypot(state.Speeds.vxMetersPerSecond, state.Speeds.vyMetersPerSecond),
              Math.toDegrees(state.Speeds.omegaRadiansPerSecond)), headingEstablished && gyroHealthy);
    if (awaitingOrientationPublication) {
      // MT2 frames captured before publishing the corrected orientation used the old heading.
      fusion.resetPose(Timer.getFPGATimestamp());
      awaitingOrientationPublication = false;
    }
    var positions = limelights.getPositionMeasurements();
    // Continue reading while disabled so those cached frames are not applied after enabling.
    applyMeasurements(positions, limelights.getHeadingMeasurements());
    for (var imu : limelights.getImuStatuses()) {
      String logPath = "Vision/IMU/" + imu.cameraName() + "/";
      SignalLogger.writeString(logPath + "State", imu.state());
      SignalLogger.writeDouble(logPath + "CameraYawDegrees", imu.cameraYawDegrees(), "degrees");
      SignalLogger.writeDouble(logPath + "HeadingErrorDegrees", imu.headingErrorDegrees(), "degrees");
    }
    SignalLogger.writeString("Vision/Position/Status", !shouldUpdatePose ? "Vision corrections disabled"
        : !headingEstablished ? "Waiting for absolute heading initialization" : poseFilter.status());
  }

  private void applyMeasurements(List<LimelightVision.Measurement> positions,
      List<LimelightVision.HeadingMeasurement> headings) {
    var feedback = readDriveFeedback();
    double now = Timer.getFPGATimestamp();
    var eligibleHeadings = headings.stream()
        .filter(candidate -> poseFilter.captureAllowed(candidate.timestampSeconds(), now)).toList();
    headingSelector.update(eligibleHeadings, now);
    var heading = firstUsableHeading(eligibleHeadings, now);
    boolean disabled = DriverStation.isDisabled();
    var collector = disabled ? headingInitializer : stationaryHeadingInitializer;
    (disabled ? stationaryHeadingInitializer : headingInitializer).reset();
    headingStatus = !shouldUpdatePose ? "Vision corrections disabled"
        : heading == null ? "No fresh reliable heading" : "Heading candidate";
    boolean correctedHeading = false;
    if (shouldUpdatePose) correctedHeading = recoverStationaryHeading(eligibleHeadings, now, collector, feedback);
    else collector.reset();
    if (shouldUpdatePose && disabled && headingEstablished && !correctedHeading) {
      correctedHeading = applyHeadingCorrections(eligibleHeadings, now, collector, feedback);
    }
    processPositions(positions, shouldUpdatePose && headingEstablished, now);
    if (shouldUpdatePose && !disabled && !correctedHeading) {
      correctedHeading = applyHeadingCorrections(eligibleHeadings, now, collector, feedback);
    }
    SignalLogger.writeBoolean("Vision/Heading/Accepted", correctedHeading);
    SignalLogger.writeString("Vision/Heading/Status", headingStatus);
    SignalLogger.writeDouble("Vision/Heading/PigeonYawDegrees",
        drivetrain.getPigeon2().getYaw().getValueAsDouble(), "degrees");
    SignalLogger.writeDouble("Vision/Heading/EstimatedDegrees",
        drivetrain.getState().Pose.getRotation().getDegrees(), "degrees");
  }

  private LimelightVision.Measurement processPositions(List<LimelightVision.Measurement> positions,
      boolean correctPose, double now) {
    LimelightVision.Measurement selected = null;
    for (var candidate : positions) {
      if (correctPose && applyPositionCorrection(candidate, now)) return candidate;
      // Explicit manual seeds may use a plausible frame rejected for a large correction or missing history.
      if (selected == null && fusion.isNewPosition(candidate)
          && poseFilter.plausible(candidate, now)) {
        selected = candidate;
        lastMeasurement = candidate;
        if (!correctPose) break;
      }
    }
    return selected;
  }

  /** Each eligible camera keeps its own evidence; select the best one that actually becomes stable. */
  private boolean recoverStationaryHeading(List<LimelightVision.HeadingMeasurement> headings, double now,
      VisionHeadingInitializer collector, DriveFeedback feedback) {
    if (DriverStation.isTest() || !feedback.healthy()) {
      collector.reset();
      headingStatus = DriverStation.isTest() ? "Test mode" : "Waiting for fresh drivetrain feedback";
      return false;
    }
    collector.observe(null, now, feedback.speed(), feedback.yawRate());
    headingStatus = collector.status();
    if (!initializationConfig.isStationary(feedback.speed(), feedback.yawRate())) return false;
    double maxError = Constants.Vision.HEADING_CONFIG.headingErrorLimitDegrees(
        feedback.speed(), feedback.yawRate(), initializationConfig);
    for (var candidate : headings) {
      double error = candidate.errorDegrees(feedback.pose());
      if (!LimelightVision.HeadingMeasurement.isErrorAllowed(error, maxError)) continue;
      var rotation = collector.observe(candidate, now, feedback.speed(), feedback.yawRate());
      if (collector.isInconsistent(candidate.cameraName())) headingSelector.reject(candidate.cameraName());
      headingStatus = collector.status();
      if (rotation.isEmpty() || !headingSelector.allows(candidate, now)) continue;
      headingSelector.select(candidate);
      lastHeadingMeasurement = candidate;
      if (!initializationConfig.enabled()) continue;
      // Small drift is corrected by fusion without discarding position history.
      if (headingEstablished && Math.abs(error) <= HEADING_AGREEMENT_DEGREES) continue;
      drivetrain.resetRotation(rotation.get());
      establishHeading(Timer.getFPGATimestamp());
      headingStatus = DriverStation.isDisabled() ? "MT1 heading initialized"
          : candidate.tagCount() == 1 ? "Stationary single-tag heading recovered" : "Stationary two-tag heading recovered";
      SignalLogger.writeString("Robot/Control/Action", headingStatus);
      SignalLogger.writeString("Vision/Heading/Camera", candidate.cameraName());
      return true;
    }
    return false;
  }

  private boolean applyPositionCorrection(LimelightVision.Measurement measurement, double now) {
    if (!fusion.isNewPosition(measurement)) return false;
    var historical = drivetrain.samplePoseAt(Utils.fpgaToCurrentTime(measurement.timestampSeconds()));
    if (!poseFilter.acceptPosition(measurement, historical.orElse(null), now)
        || !fusion.addPosition(measurement, now, historical.orElse(null))) return false;
    lastMeasurement = measurement;
    lastAcceptedMeasurement = measurement;
    return true;
  }

  private void establishHeading(double now) {
    headingEstablished = true;
    observedPoseResetVersion = drivetrain.getPoseResetVersion();
    resetHeadingEvidence();
    limelights.reseedIMUs();
    awaitingOrientationPublication = true;
    fusion.resetPose(now);
    lastMeasurement = null;
    lastAcceptedMeasurement = null;
    poseFilter.resetRecovery();
  }

  private void resetHeadingEvidence() {
    headingReadiness.reset();
    headingInitializer.reset();
    stationaryHeadingInitializer.reset();
  }

  private LimelightVision.HeadingMeasurement firstUsableHeading(
      List<LimelightVision.HeadingMeasurement> headings, double now) {
    for (var heading : headings) {
      if (headingSelector.allows(heading, now, false)) {
        lastHeadingMeasurement = heading;
        return heading;
      }
    }
    return null;
  }

  private boolean applyHeadingCorrections(List<LimelightVision.HeadingMeasurement> headings, double now,
      VisionHeadingInitializer collector, DriveFeedback feedback) {
    if (DriverStation.isTest()) { headingStatus = "Test mode"; return false; }
    boolean stationary = initializationConfig.isStationary(feedback.speed(), feedback.yawRate());
    double maxError = Constants.Vision.HEADING_CONFIG.headingErrorLimitDegrees(
        feedback.speed(), feedback.yawRate(), initializationConfig);
    for (var heading : headings) {
      if (stationary && collector.isInconsistent(heading.cameraName())) {
        headingStatus = "Rejected inconsistent stationary heading";
        continue;
      }
      if (heading.tagCount() < 2 && (!stationary || !collector.isQualified(heading, now))) continue;
      if (!fusion.isNewHeading(heading) || !headingSelector.allows(heading, now, !stationary)) continue;
      boolean applied = fusion.addHeading(heading, now, maxError);
      SignalLogger.writeDouble("Vision/Heading/ErrorDegrees", fusion.headingErrorDegrees(), "degrees");
      headingStatus = fusion.status();
      if (!applied) {
        headingReadiness.reset(heading.cameraName());
        headingSelector.reject(heading.cameraName());
        continue;
      }
      lastHeadingMeasurement = heading;

      if (!headingEstablished && headingReadiness.observe(heading.cameraName(),
          fusion.headingErrorDegrees(), heading.timestampSeconds(), now)) {
        headingSelector.select(heading);
        // Heading has converged through normal fusion; never snap it while moving.
        establishHeading(Timer.getFPGATimestamp());
        SignalLogger.writeString("Robot/Control/Action", "MT1 heading confirmed through fusion");
      }
      if (!stationary) headingSelector.select(heading);
      return true;
    }
    return false;
  }

  private DriveFeedback readDriveFeedback() {
    boolean healthy = shouldUpdatePose && HealthChecks.driveHealthy(drivetrain, initializationConfig.maxSignalAgeSeconds());
    var state = drivetrain.getState();
    return new DriveFeedback(state.Pose, Math.hypot(state.Speeds.vxMetersPerSecond, state.Speeds.vyMetersPerSecond),
        Math.toDegrees(state.Speeds.omegaRadiansPerSecond), healthy);
  }

  @Override
  public void close() {
    CommandScheduler.getInstance().unregisterSubsystem(this);
    limelights.close();
  }
}
