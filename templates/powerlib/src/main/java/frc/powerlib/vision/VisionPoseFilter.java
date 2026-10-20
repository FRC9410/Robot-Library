package frc.powerlib.vision;

import edu.wpi.first.math.geometry.Pose2d;
import frc.powerlib.configs.VisionPoseFilterConfig;
import frc.powerlib.health.HealthChecks;
import frc.powerlib.vision.LimelightVision.Measurement;
import java.util.Objects;

/** Capture-time tilt gate and temporal agreement check for large position corrections. */
public final class VisionPoseFilter {
  private final VisionPoseFilterConfig config;
  private final double maxFrameAgeSeconds;
  private double observedAt = Double.NaN;
  private double levelSince = Double.NaN;
  private double lastFrame = Double.NEGATIVE_INFINITY;
  private double recoveryFirst;
  private double recoveryLast = Double.NEGATIVE_INFINITY;
  private double anchorX;
  private double anchorY;
  private int count;
  private String status = "Waiting for level gyro feedback";

  public VisionPoseFilter(VisionPoseFilterConfig config, double maxFrameAgeSeconds) {
    this.config = Objects.requireNonNull(config, "config");
    if (!Double.isFinite(maxFrameAgeSeconds) || maxFrameAgeSeconds <= 0) {
      throw new IllegalArgumentException("maxFrameAgeSeconds must be positive and finite");
    }
    this.maxFrameAgeSeconds = maxFrameAgeSeconds;
  }

  public String status() { return status; }

  /** Call every robot loop, including while vision fusion is disabled. Never infer across a gap. */
  public void observe(double now, double pitchDegrees, double rollDegrees, boolean gyroHealthy) {
    boolean valid = Double.isFinite(now) && now >= 0 && Double.isFinite(pitchDegrees)
        && Double.isFinite(rollDegrees) && gyroHealthy;
    if (!valid || now < observedAt || now - observedAt > config.maxOrientationAgeSeconds()) {
      levelSince = Double.NaN;
      resetRecovery();
    }
    observedAt = valid ? now : Double.NaN;
    if (!valid || Math.abs(pitchDegrees) > config.maxTiltDegrees() || Math.abs(rollDegrees) > config.maxTiltDegrees()) {
      levelSince = Double.NaN;
      resetRecovery();
      status = valid ? "Rejected tilted robot" : "Waiting for fresh gyro feedback";
      return;
    }
    if (Double.isNaN(levelSince)) levelSince = now;
    status = now - levelSince < config.levelSettleSeconds() ? "Waiting for level settling" : "Level feedback ready";
  }

  /** Delayed images from the tilt/settle interval remain rejected even after the robot is level. */
  public boolean captureAllowed(double timestampSeconds, double now) {
    return Double.isFinite(levelSince) && Double.isFinite(now)
        && HealthChecks.isFresh(now - observedAt, config.maxOrientationAgeSeconds())
        && observedAt - levelSince >= config.levelSettleSeconds()
        && timestampSeconds >= levelSince + config.levelSettleSeconds()
        && HealthChecks.isFresh(now - timestampSeconds, maxFrameAgeSeconds);
  }

  /** Also used for disabled manual seeding; an explicit seed does not compare against old odometry. */
  public boolean plausible(Measurement measurement, double now) {
    if (measurement == null || !HealthChecks.finitePose(measurement.pose())
        || !captureAllowed(measurement.timestampSeconds(), now)
        || !Double.isFinite(measurement.heightMeters()) || Math.abs(measurement.heightMeters()) > config.maxHeightMeters()
        || measurement.tagCount() < 1 || !Double.isFinite(measurement.positionStdDev()) || measurement.positionStdDev() <= 0
        || !Double.isFinite(measurement.averageTagDistanceMeters()) || measurement.averageTagDistanceMeters() < 0) {
      return false;
    }
    var pose = measurement.pose();
    return pose.getX() >= config.minX() - config.fieldMarginMeters()
        && pose.getX() <= config.maxX() + config.fieldMarginMeters()
        && pose.getY() >= config.minY() - config.fieldMarginMeters()
        && pose.getY() <= config.maxY() + config.fieldMarginMeters();
  }

  /** Historical pose must be sampled at image capture, not at receive time. No history means no fusion. */
  public boolean acceptPosition(Measurement measurement, Pose2d historicalPose, double now) {
    if (measurement == null) return false;
    double timestamp = measurement.timestampSeconds();
    if (!HealthChecks.isFresh(now - timestamp, maxFrameAgeSeconds)) {
      resetRecovery(); status = "Rejected stale or future position"; return false;
    }
    if (timestamp <= lastFrame) return false;
    lastFrame = timestamp; // Consume rejected samples too; a second call cannot supply extra evidence.
    if (!plausible(measurement, now) || !HealthChecks.finitePose(historicalPose)) {
      resetRecovery();
      status = "Rejected capture, position bounds or missing pose history";
      return false;
    }
    double dx = measurement.pose().getX() - historicalPose.getX();
    double dy = measurement.pose().getY() - historicalPose.getY();
    if (!Double.isFinite(dx) || !Double.isFinite(dy)) {
      resetRecovery(); status = "Rejected invalid position difference"; return false;
    }
    if (Math.hypot(dx, dy) <= config.maxSingleCorrectionMeters()) {
      resetRecovery(); status = "Accepted position"; return true;
    }
    // Compare correction vectors so legitimate robot travel does not look like camera disagreement.
    if (count == 0 || timestamp - recoveryLast > maxFrameAgeSeconds
        || Math.hypot(dx - anchorX, dy - anchorY) > config.recoverySpreadMeters()) {
      resetRecovery();
      anchorX = dx;
      anchorY = dy;
      recoveryFirst = timestamp;
    }
    recoveryLast = timestamp;
    count++;
    if (count < config.recoveryFrames() || timestamp - recoveryFirst < config.recoverySeconds()) {
      status = "Waiting for consistent large position correction";
      return false;
    }
    status = "Accepted consistent position recovery";
    return true;
  }

  public void resetRecovery() { count = 0; recoveryLast = Double.NEGATIVE_INFINITY; }
}
