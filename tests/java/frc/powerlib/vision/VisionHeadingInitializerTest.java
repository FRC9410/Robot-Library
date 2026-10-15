package frc.powerlib.vision;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import org.junit.Test;

public class VisionHeadingInitializerTest {
  private static HeadingMeasurement frame(double time, double yaw) {
    return new HeadingMeasurement("camera", new Pose2d(2, 3, Rotation2d.fromDegrees(yaw)), time, 0.1);
  }

  @Test public void automaticInitializationIsDisabledByDefault() {
    var config = VisionHeadingInitializationConfig.DEFAULT;
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
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT.withEnabled(true), 0.2);
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
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT.withEnabled(true), 0.2);
    var same = frame(10, 90);
    for (int i = 0; i < 20; i++) assertTrue(initializer.update(same, 10.1, 0, 0).isEmpty());
  }

  @Test public void motionStaleFutureAndMissingFramesBreakTheWindow() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT.withEnabled(true), 0.2);
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

  @Test public void inconsistentHeadingsAndCameraSwitchesRestartTheWindow() {
    var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT.withEnabled(true), 0.2);
    for (int i = 0; i < 30; i++) {
      double time = 10 + i * 0.02;
      assertTrue(initializer.update(frame(time, i % 2 == 0 ? 20 : 25), time, 0, 0).isEmpty());
    }
    initializer.reset();
    for (int i = 0; i < 10; i++) initializer.update(frame(11 + i * 0.02, 20), 11 + i * 0.02, 0, 0);
    var other = new HeadingMeasurement("other", new Pose2d(2, 3, Rotation2d.fromDegrees(20)), 11.2, 0.1);
    assertTrue(initializer.update(other, 11.2, 0, 0).isEmpty());
  }
}
