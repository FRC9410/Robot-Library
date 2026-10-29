package frc.powerlib.vision;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import org.junit.Test;

public class VisionHeadingInitializerTest {
  @Test public void stationaryClassificationAndCorrectionLimitsShareTheConfiguredPolicy() {
    var policy = new VisionHeadingInitializationConfig(true, .25, 5, 2, .2, 10, .4);
    var limits = frc.powerlib.configs.LimelightHeadingConfig.DEFAULT;
    assertTrue(policy.isStationary(.1, 6));
    assertTrue(policy.isStationary(-.2, -10));
    assertFalse(policy.isStationary(.2001, 0));
    assertFalse(policy.isStationary(0, 10.001));
    assertFalse(policy.isStationary(Double.NaN, 0));
    assertFalse(policy.isStationary(0, Double.POSITIVE_INFINITY));
    assertEquals(180, limits.headingErrorLimitDegrees(.1, 6, policy), 0);
    assertEquals(45, limits.headingErrorLimitDegrees(.21, 0, policy), 0);
    assertEquals(45, limits.headingErrorLimitDegrees(.1, 6), 0);
    assertTrue(Double.isNaN(limits.headingErrorLimitDegrees(Double.NaN, 0, policy)));
  }

  @Test public void passiveStabilityStillQualifiesCamerasWhenAutomaticInitializationIsDisabled() {
    var collector = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT.withEnabled(false), .2);
    boolean ready = false;
    for (int i = 0; i <= 20; i++) {
      double now = 10 + i * .02;
      ready |= collector.observe(frame(now, 20), now, 0, 0).isPresent();
    }
    assertTrue(ready);
    assertTrue(collector.isQualified(frame(10.4, 20), 10.4));
    assertFalse(collector.isInitialized());
    assertTrue(collector.update(frame(10.42, 20), 10.42, 0, 0).isEmpty());
  }

  private static HeadingMeasurement single(double time, double heading) {
    return new HeadingMeasurement("single", new Pose2d(2, 3, Rotation2d.fromDegrees(heading)), time, .1, 1, 1.5, .02, 0);
  }

  @Test public void qualificationPersistsBetweenWindowsAndClearsOnInvalidEvidenceOrMotion() {
    var collector = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
    for (int i = 0; i <= 30; i++) {
      double now = 10 + i * .02;
      var candidate = single(now, 0);
      collector.observe(candidate, now, 0, 0);
      if (i < 25) assertFalse(collector.isQualified(candidate, now));
      if (i >= 26) assertTrue(collector.isQualified(candidate, now));
    }
    assertFalse(collector.isQualified(single(10.6, 0), 10.71));
    collector.observe(single(10.62, 4), 10.62, 0, 0);
    assertFalse(collector.isQualified(single(10.62, 4), 10.62));
    for (int i = 0; i <= 30; i++) {
      double now = 11 + i * .02;
      collector.observe(single(now, 0), now, 0, 0);
    }
    assertTrue(collector.isQualified(single(11.6, 0), 11.6));
    collector.observe(null, 11.62, .1, 0);
    collector.observe(single(11.64, 0), 11.64, 0, 0);
    assertFalse(collector.isQualified(single(11.64, 0), 11.64));
    collector.observe(null, 12, 0, 0);
    assertFalse(collector.isQualified(single(11.64, 0), 12));
  }

  @Test public void multiTagQualificationCannotImmediatelyAuthorizeSingleTagFusion() {
    var collector = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
    for (int i = 0; i <= 20; i++) {
      double now = 10 + i * .02;
      collector.observe(new HeadingMeasurement("single", new Pose2d(2, 3, Rotation2d.kZero), now, .1, 2), now, 0, 0);
    }
    var firstSingle = single(10.42, 0);
    collector.observe(firstSingle, 10.42, 0, 0);
    assertFalse(collector.isQualified(firstSingle, 10.42));
    var weak = new HeadingMeasurement("single", firstSingle.pose(), 10.44, .1, 1, 1.5, .1, 0);
    collector.observe(weak, 10.44, 0, 0);
    assertFalse(collector.isQualified(weak, 10.44));
  }

  @Test public void deferredStableCandidatesDoNotLatchOrConsumeAnotherCamerasWindow() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
    int ready = 0;
    for (int i = 0; i < 20; i++) {
      double now = 10 + i * .02;
      initializer.observe(new HeadingMeasurement("first", new Pose2d(2, 3, Rotation2d.kZero), now, .1, 2), now, 0, 0);
      var result = initializer.observe(new HeadingMeasurement("second", new Pose2d(2, 3, Rotation2d.fromDegrees(90)),
          now, .1, 2), now, 0, 0);
      if (result.isPresent()) {
        assertEquals(90, result.get().getDegrees(), 1e-9);
        ready++;
      }
    }
    assertTrue(ready > 0);
    assertFalse(initializer.isInitialized());
    initializer.observe(new HeadingMeasurement("first", new Pose2d(2, 3, Rotation2d.fromDegrees(8)), 10.4, .1, 2), 10.4, 0, 0);
    assertTrue(initializer.isInconsistent("first"));
    assertFalse(initializer.isInconsistent("second"));
    for (int i = 1; i <= 15; i++) {
      double now = 10.4 + i * .02;
      initializer.observe(new HeadingMeasurement("first", new Pose2d(2, 3, Rotation2d.fromDegrees(8)), now, .1, 2), now, 0, 0);
    }
    assertFalse(initializer.isInconsistent("first"));
  }

  @Test public void ongoingWindowsDoNotMistakeSlowMeasuredYawForCameraInstability() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
    int ready = 0;
    for (int i = 0; i < 250; i++) {
      double now = 10 + i * .02;
      var result = initializer.observe(new HeadingMeasurement("camera",
          new Pose2d(2, 3, Rotation2d.fromDegrees(i * .08)), now, .1, 2), now, 0, 4);
      if (result.isPresent()) ready++;
      assertFalse(initializer.isInconsistent("camera"));
    }
    assertTrue(ready > 10);
  }

  private static HeadingMeasurement frame(double time, double yaw) {
    return new HeadingMeasurement("camera", new Pose2d(2, 3, Rotation2d.fromDegrees(yaw)), time, 0.1, 2);
  }

  @Test public void automaticInitializationCanBeExplicitlyDisabled() {
    var config = VisionHeadingInitializationConfig.DEFAULT.withEnabled(false);
    var initializer = new VisionHeadingInitializer(config, 0.2);
    for (int i = 0; i < 30; i++) {
      double time = 10 + i * 0.02;
      assertTrue(initializer.update(frame(time, 90), time, 0, 0).isEmpty());
    }
    assertFalse(config.enabled());
    assertEquals("Automatic heading initialization disabled", initializer.status());
    assertEquals(config, config.withEnabled(true).withEnabled(false));
  }

  @Test public void configuredStationaryLimitsAndSampleWindowAreHonored() {
    var config = new VisionHeadingInitializationConfig(true, 0.1, 3, 1, 0.2, 10, 0.5);
    var initializer = new VisionHeadingInitializer(config, 0.2);
    assertTrue(initializer.update(frame(10, 90), 10, 0.1, 6).isEmpty());
    assertTrue(initializer.update(frame(10.06, 90.5), 10.06, 0.1, 6).isEmpty());
    var heading = initializer.update(frame(10.12, 90), 10.12, 0.1, 6).orElseThrow();
    assertEquals(90.166666, heading.getDegrees(), 1e-5);
  }

  @Test public void invalidInitializationPoliciesAreRejected() {
    assertThrows(IllegalArgumentException.class,
        () -> new VisionHeadingInitializationConfig(true, 0, 5, 2, 0.05, 5, 0.5));
    assertThrows(IllegalArgumentException.class,
        () -> new VisionHeadingInitializationConfig(true, 0.25, 1, 2, 0.05, 5, 0.5));
    assertThrows(IllegalArgumentException.class,
        () -> new VisionHeadingInitializationConfig(true, 0.25, 5, 181, 0.05, 5, 0.5));
    assertThrows(IllegalArgumentException.class,
        () -> new VisionHeadingInitializationConfig(true, 0.25, 5, 2, Double.NaN, 5, 0.5));
    assertThrows(IllegalArgumentException.class,
        () -> new VisionHeadingInitializationConfig(true, 0.25, 5, 2, 0.05, -1, 0.5));
    assertThrows(IllegalArgumentException.class,
        () -> new VisionHeadingInitializationConfig(true, 0.25, 5, 2, 0.05, 5, Double.POSITIVE_INFINITY));
    assertThrows(IllegalArgumentException.class,
        () -> new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, 0));
  }

  @Test public void stableFramesInitializeLargeErrorsAndAverageAcrossAngleWrap() {
    assertTrue(VisionHeadingInitializationConfig.DEFAULT.enabled());
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, 0.2);
    for (int i = 0; i < 13; i++) {
      double time = 10 + i * 0.02;
      assertTrue(initializer.update(frame(time, i % 2 == 0 ? 179.5 : -179.5), time, 0, 0).isEmpty());
    }
    var result = initializer.update(frame(10.26, -179.5), 10.26, 0, 0).orElseThrow();
    assertEquals(180, Math.abs(result.getDegrees()), 1e-8);
    assertTrue(initializer.update(frame(10.28, 0), 10.28, 0, 0).isEmpty());
    initializer.reset();
    assertTrue(initializer.update(frame(11, 90), 11, 0, 0).isEmpty());
  }

  @Test public void repeatedFramesNeverSatisfyTheStableWindow() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, 0.2);
    var same = frame(10, 90);
    for (int i = 0; i < 20; i++) assertTrue(initializer.update(same, 10.1, 0, 0).isEmpty());
  }

  @Test public void motionStaleFutureAndMissingFramesBreakTheWindow() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, 0.2);
    for (int i = 0; i < 10; i++) initializer.update(frame(10 + i * 0.02, 60), 10 + i * 0.02, 0, 0);
    assertTrue(initializer.update(frame(10.2, 60), 10.2, 0.1, 0).isEmpty());
    assertEquals("Waiting for stationary robot", initializer.status());
    assertTrue(initializer.update(frame(10.3, 60), 10.3, 0, 6).isEmpty());
    assertTrue(initializer.update(frame(10.4, 60), 11, 0, 0).isEmpty());
    assertTrue(initializer.update(frame(12, 60), 11, 0, 0).isEmpty());
    assertTrue(initializer.update(frame(11, 60), 11, Double.NaN, 0).isEmpty());
    initializer.update(frame(12, 60), 12, 0, 0);
    initializer.update(null, 12.3, 0, 0);
    assertTrue(initializer.update(frame(12.32, 60), 12.32, 0, 0).isEmpty());
  }

  @Test public void inconsistentHeadingsRestartOnlyTheirOwnCameraWindow() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, 0.2);
    for (int i = 0; i < 30; i++) {
      double time = 10 + i * 0.02;
      assertTrue(initializer.update(frame(time, i % 2 == 0 ? 20 : 25), time, 0, 0).isEmpty());
    }
    initializer.reset();
    for (int i = 0; i < 10; i++) initializer.update(frame(11 + i * 0.02, 20), 11 + i * 0.02, 0, 0);
    var other = new HeadingMeasurement("other", new Pose2d(2, 3, Rotation2d.fromDegrees(20)), 11.2, 0.1);
    assertTrue(initializer.update(other, 11.2, 0, 0).isEmpty());
  }

  @Test public void alternatingCameraCadencesDoNotStarveInitializationOrMixAngles() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
    boolean initialized = false;
    for (int i = 0; i < 250; i++) {
      double time = 10 + i * .02;
      boolean primary = i % 3 == 0;
      var measurement = new HeadingMeasurement(primary ? "primary" : "secondary",
          new Pose2d(2, 3, Rotation2d.fromDegrees(primary ? 30 : 90)), time, .1, 2);
      var result = initializer.update(measurement, time, 0, 0);
      if (result.isPresent()) {
        assertEquals(measurement.pose().getRotation().getDegrees(), result.get().getDegrees(), 1e-9);
        assertTrue(i >= 13);
        initialized = true;
        break;
      }
    }
    assertTrue(initialized);
  }

  @Test public void oneUnstableCameraCannotEraseStableCameraEvidence() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
    java.util.Optional<Rotation2d> result = java.util.Optional.empty();
    for (int i = 0; i < 20 && result.isEmpty(); i++) {
      double time = 10 + i * .02;
      initializer.update(new HeadingMeasurement("bad",
          new Pose2d(2, 3, Rotation2d.fromDegrees(i % 2 == 0 ? 0 : 30)), time, .1, 2), time, 0, 0);
      result = initializer.update(new HeadingMeasurement("good",
          new Pose2d(2, 3, Rotation2d.fromDegrees(90)), time, .1, 2), time, 0, 0);
    }
    assertEquals(90, result.orElseThrow().getDegrees(), 1e-9);
    assertTrue(initializer.isInitialized());
  }

  @Test public void singleTagRequiresLongerTighterEvidenceAndExplicitQuality() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
    java.util.Optional<Rotation2d> result = java.util.Optional.empty();
    for (int i = 0; i <= 27 && result.isEmpty(); i++) {
      double time = 10 + i * .02;
      var single = new HeadingMeasurement("single", new Pose2d(2, 3, Rotation2d.fromDegrees(90)),
          time, .1, 1, 1.5, .02, 0);
      result = initializer.update(single, time, 0, 0);
      if (i < 25) assertTrue("Single-tag evidence must span at least half a second", result.isEmpty());
    }
    assertEquals(90, result.orElseThrow().getDegrees(), 1e-9);
    initializer.reset();
    for (int i = 0; i < 40; i++) {
      double time = 11 + i * .02;
      var uncertain = new HeadingMeasurement("single", new Pose2d(2, 3, Rotation2d.fromDegrees(90)),
          time, .1, 1, 1.5, .1, 0);
      assertTrue(initializer.update(uncertain, time, 0, 0).isEmpty());
    }
  }
}
