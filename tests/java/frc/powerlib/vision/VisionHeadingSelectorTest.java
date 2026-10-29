package frc.powerlib.vision;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import java.util.List;
import org.junit.Test;

public class VisionHeadingSelectorTest {
  private static HeadingMeasurement frame(String camera, double time, double distance, double heading) {
    return new HeadingMeasurement(camera, new Pose2d(2, 3, Rotation2d.fromDegrees(heading)),
        time, .1, 2, distance, .05, 1);
  }
  private static VisionHeadingSelector selector() {
    return new VisionHeadingSelector(VisionHeadingInitializationConfig.DEFAULT, .2);
  }

  @Test public void fasterConflictingCameraCannotWinBetweenPreferredFrames() {
    var selector = selector();
    selector.select(frame("preferred", 10, 1.5, 0));
    for (int i = 1; i < 100; i++) {
      double now = 10 + i * .02;
      var other = frame("other", now - .05, 3, 12);
      var preferred = frame("preferred", now - .09, 1.5, 0);
      selector.update(i % 3 == 0 ? List.of(preferred, other) : List.of(other), now);
      assertFalse(selector.allows(other, now));
      if (i % 3 == 0) assertTrue(selector.allows(preferred, now));
    }
  }

  @Test public void newestFrameAloneCannotChangeAnEqualQualitySelection() {
    var selector = selector();
    selector.select(frame("selected", 10, 2, 0));
    for (int i = 1; i < 30; i++) {
      double now = 10 + i * .02;
      var other = frame("other", now, 2, 12);
      selector.update(List.of(frame("selected", now - .05, 2, 0), other), now);
      assertFalse(selector.allows(other, now));
    }
  }

  @Test public void betterCameraNeedsSustainedDistinctEvidenceBeforeHandoff() {
    var selector = selector();
    selector.select(frame("selected", 10, 3, 12));
    for (int i = 1; i <= 20; i++) {
      double now = 10 + i * .02;
      var better = frame("better", now - .02, 1.5, 0);
      selector.update(List.of(better, frame("selected", now, 3, 12)), now);
      assertEquals(i >= 14, selector.allows(better, now));
      assertFalse(selector.allows(better, now, false));
    }
    selector.select(frame("better", 10.4, 1.5, 0));
    assertFalse(selector.allows(frame("selected", 10.4, 3, 12), 10.4));
  }

  @Test public void dropoutAndDownstreamRejectionAllowBackupWithoutManualAction() {
    var selector = selector();
    selector.select(frame("selected", 10, 1.5, 0));
    var other = frame("other", 10.1, 3, 12);
    selector.update(List.of(other), 10.1);
    assertFalse(selector.allows(other, 10.1));
    other = frame("other", 10.21, 3, 12);
    selector.update(List.of(other), 10.21);
    assertTrue(selector.allows(other, 10.21));
    selector.select(other);
    selector.reject("unrelated");
    assertFalse(selector.allows(frame("third", 10.22, 4, 30), 10.22));
    selector.reject("other");
    assertTrue(selector.allows(frame("third", 10.22, 4, 30), 10.22));
  }

  @Test public void frozenAndIntermittentlyWorseChallengersCannotAccumulateQualification() {
    var selector = selector();
    selector.select(frame("selected", 10, 3, 12));
    for (int i = 1; i < 30; i++) {
      double now = 10 + i * .02;
      var frozen = frame("frozen", 10.02, 1.5, 0);
      var fluctuating = frame("fluctuating", now, i % 5 == 0 ? 4 : 1.5, 0);
      selector.update(List.of(frame("selected", now, 3, 12), frozen, fluctuating), now);
      assertFalse(selector.allows(frozen, now));
      assertFalse(selector.allows(fluctuating, now));
    }
  }

  @Test public void singleTagSelectionExpiresAtItsStricterFreshnessLimit() {
    var selector = selector();
    var single = new HeadingMeasurement("single", new Pose2d(2, 3, Rotation2d.kZero), 10, .1, 1, 1.5, .02, 0);
    selector.select(single);
    var backup = frame("two-tags", 10.11, 3, 12);
    selector.update(List.of(backup), 10.11);
    assertTrue(selector.allows(backup, 10.11));
    assertFalse(selector.allows(single, 10.11));
  }
}
