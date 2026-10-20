package frc.powerlib.vision;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import frc.powerlib.configs.VisionPoseFilterConfig;
import frc.powerlib.vision.LimelightVision.Measurement;
import org.junit.Test;

public class VisionPoseFilterTest {
  private static final VisionPoseFilterConfig CONFIG = VisionPoseFilterConfig.forField(0, 16.541, 0, 8.069);
  private static final Pose2d HISTORY = pose(2, 3);

  private static Pose2d pose(double x, double y) { return new Pose2d(x, y, Rotation2d.kZero); }
  private static Measurement frame(double x, double y, double capture) {
    return new Measurement("camera", pose(x, y), capture, 1, 2, 0.28, 0);
  }
  private static VisionPoseFilter ready() {
    var filter = new VisionPoseFilter(CONFIG, 0.5);
    observeLevel(filter, 9.6, 10);
    return filter;
  }
  private static void observeLevel(VisionPoseFilter filter, double from, double through) {
    for (int i = 0; from + i * 0.02 <= through + 1e-9; i++) filter.observe(Math.min(through, from + i * 0.02), 0, 0, true);
  }

  @Test public void startupRequiresObservedStableLevelGroundAndFreshGyroFeedback() {
    var filter = new VisionPoseFilter(CONFIG, 0.5);
    assertFalse(filter.captureAllowed(10, 10));
    filter.observe(10, 0, 0, true);
    filter.observe(10.08, 0, 0, true);
    assertFalse(filter.captureAllowed(10.08, 10.08));
    filter.observe(10.16, 0, 0, true);
    assertTrue(filter.captureAllowed(10.16, 10.16));
    assertFalse(filter.captureAllowed(10.1, 10.16)); // Captured during settling.
    assertFalse(filter.captureAllowed(10.16, 10.3)); // Gyro observations have stopped.
  }

  @Test public void delayedTiltAndLandingFramesCannotReplayWhenRobotBecomesLevel() {
    var filter = ready();
    filter.observe(10.02, 15, 0, true);
    assertFalse(filter.plausible(frame(2, 3, 10), 10.02));
    observeLevel(filter, 10.04, 10.3);
    assertFalse(filter.captureAllowed(10.02, 10.3));
    assertFalse(filter.captureAllowed(10.1, 10.3));
    assertFalse(filter.captureAllowed(10.18, 10.3));
    assertTrue(filter.captureAllowed(10.22, 10.3));
    assertFalse(filter.acceptPosition(frame(5, 3, 10.1), HISTORY, 10.3));
    assertTrue(filter.acceptPosition(frame(2.1, 3, 10.24), HISTORY, 10.3));
  }

  @Test public void eitherTiltAxisInvalidGyroAndSamplingGapsRestartSettling() {
    for (int fault = 0; fault < 7; fault++) {
      var filter = ready();
      switch (fault) {
        case 0 -> filter.observe(10.02, -9, 0, true);
        case 1 -> filter.observe(10.02, 0, 9, true);
        case 2 -> filter.observe(10.02, Double.NaN, 0, true);
        case 3 -> filter.observe(10.02, 0, Double.POSITIVE_INFINITY, true);
        case 4 -> filter.observe(10.02, 0, 0, false);
        case 5 -> filter.observe(10.3, 0, 0, true);
        case 6 -> filter.observe(9.9, 0, 0, true);
      }
      assertFalse(filter.captureAllowed(10.02, 10.02));
      observeLevel(filter, 10.6, 10.82); // A definite observation gap starts a new level interval.
      assertFalse("fault " + fault, filter.captureAllowed(10.7, 10.82));
      assertTrue("fault " + fault, filter.captureAllowed(10.8, 10.82));
    }
  }

  @Test public void plausiblePositionsMustStayInsideFieldMarginAndHeightBounds() {
    var filter = ready();
    assertTrue(filter.plausible(frame(-0.25, 3, 9.95), 10));
    assertTrue(filter.plausible(frame(16.791, 8.319, 9.95), 10));
    for (var bad : new Measurement[] {
        frame(-0.251, 3, 9.95), frame(17, 3, 9.95), frame(2, -1, 9.95), frame(2, 9, 9.95),
        frame(Double.NaN, 3, 9.95), new Measurement("camera", HISTORY, 9.95, 1, 2, .28, .501),
        new Measurement("camera", HISTORY, 9.95, 1, 2, .28, -.501),
        new Measurement("camera", HISTORY, 9.95, 1, 2, .28, Double.NaN),
        new Measurement("camera", HISTORY, 9.95, 0, 2, .28),
        new Measurement("camera", HISTORY, 9.95, 1, 2, 0),
        new Measurement("camera", HISTORY, 9.95, 1, Double.NaN, .28)}) {
      assertFalse(filter.plausible(bad, 10));
    }
    assertTrue(filter.plausible(new Measurement("camera", HISTORY, 9.95, 1, 2, .28, .5), 10));
    assertTrue(filter.plausible(new Measurement("camera", HISTORY, 9.95, 1, 2, .28, -.5), 10));
  }

  @Test public void normalCorrectionUsesCaptureTimeOdometryAndNeedsHistory() {
    var filter = ready();
    assertTrue(filter.acceptPosition(frame(2.5, 3.5, 9.95), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(2.5, 3.5, 9.96), null, 10));
    assertFalse(filter.acceptPosition(frame(2.5, 3.5, 9.96), HISTORY, 10)); // Missing history cannot be retried.
    assertTrue(filter.acceptPosition(frame(2.5, 3.5, 9.97), HISTORY, 10));
  }

  @Test public void oneLargeOrMultitagOutlierCannotMoveTheEstimator() {
    var filter = ready();
    assertFalse(filter.acceptPosition(frame(6, 3, 9.95), HISTORY, 10));
    assertFalse(filter.acceptPosition(new Measurement("other", pose(6, 3), 9.95, 3, 2, .1), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(6, 3, 9.97), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(6, 3, 9.99), HISTORY, 10)); // Count alone is insufficient.
    observeLevel(filter, 10.02, 10.08);
    assertTrue(filter.acceptPosition(frame(6, 3, 10.07), HISTORY, 10.08));
    assertEquals("Accepted consistent position recovery", filter.status());
  }

  @Test public void repeatedAgreeingCorrectionsCanRecoverSeveralMetersOfWheelSlipWhileMoving() {
    var filter = ready();
    assertFalse(filter.acceptPosition(frame(6, 3, 9.94), pose(2, 3), 10));
    assertFalse(filter.acceptPosition(frame(7, 3, 9.99), pose(3, 3), 10));
    observeLevel(filter, 10.02, 10.08);
    assertTrue(filter.acceptPosition(frame(8, 3, 10.06), pose(4, 3), 10.08));
  }

  @Test public void inconsistentOrInvalidFramesAndNormalCorrectionsClearRecoveryEvidence() {
    var filter = ready();
    assertFalse(filter.acceptPosition(frame(6, 3, 9.94), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(6, 3, 9.98), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(3, 6, 9.99), HISTORY, 10)); // Different correction direction.
    observeLevel(filter, 10.02, 10.12);
    assertFalse(filter.acceptPosition(frame(6, 3, 10.02), HISTORY, 10.12));
    assertFalse(filter.acceptPosition(frame(6, 3, 10.06), HISTORY, 10.12));
    assertFalse(filter.acceptPosition(frame(99, 3, 10.08), HISTORY, 10.12));
    assertFalse(filter.acceptPosition(frame(6, 3, 10.1), HISTORY, 10.12));
    assertTrue(filter.acceptPosition(frame(2.1, 3, 10.11), HISTORY, 10.12));
    observeLevel(filter, 10.14, 10.24);
    assertFalse(filter.acceptPosition(frame(6, 3, 10.22), HISTORY, 10.24));
  }

  @Test public void orientationLossAndLongCameraGapsCannotBridgeRecoveryEvidence() {
    var filter = ready();
    assertFalse(filter.acceptPosition(frame(6, 3, 9.94), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(6, 3, 9.99), HISTORY, 10));
    observeLevel(filter, 10.02, 10.7);
    assertFalse(filter.acceptPosition(frame(6, 3, 10.69), HISTORY, 10.7));
    filter.observe(10.72, 9, 0, true);
    observeLevel(filter, 10.74, 11.02);
    assertFalse(filter.acceptPosition(frame(6, 3, 11), HISTORY, 11.02));
  }

  @Test public void staleFutureAndNonfiniteTimestampsCannotPoisonLaterValidSamples() {
    var filter = ready();
    for (double time : new double[] {9, 11, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertFalse(filter.acceptPosition(frame(2, 3, time), HISTORY, 10));
    }
    assertTrue(filter.acceptPosition(frame(2.1, 3, 9.95), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(2.1, 3, 9.95), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(2.1, 3, 9.94), HISTORY, 10));
  }

  @Test public void clearingRecoveryDoesNotPermitReplayingAnOldFrame() {
    var filter = ready();
    assertFalse(filter.acceptPosition(frame(6, 3, 9.94), HISTORY, 10));
    filter.resetRecovery();
    assertFalse(filter.acceptPosition(frame(6, 3, 9.94), HISTORY, 10));
    assertFalse(filter.acceptPosition(frame(6, 3, 9.99), HISTORY, 10));
  }

  @Test public void configurationRejectsInvalidLimits() {
    assertThrows(IllegalArgumentException.class, () -> VisionPoseFilterConfig.forField(1, 0, 0, 8));
    assertThrows(IllegalArgumentException.class, () -> VisionPoseFilterConfig.forField(0, 16, Double.NaN, 8));
    assertThrows(IllegalArgumentException.class, () -> new VisionPoseFilterConfig(0, 16, 0, 8, .25, .5, 8, .15, .1, 1, 1, .1, .25));
    assertThrows(IllegalArgumentException.class, () -> new VisionPoseFilterConfig(0, 16, 0, 8, .25, .5, 91, .15, .1, 1, 3, .1, .25));
    assertThrows(IllegalArgumentException.class, () -> new VisionPoseFilter(CONFIG, Double.NaN));
    assertThrows(IllegalArgumentException.class, () -> new VisionPoseFilter(CONFIG, 0));
  }
}
