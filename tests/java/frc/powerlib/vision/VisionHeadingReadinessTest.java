package frc.powerlib.vision;

import static org.junit.Assert.*;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import org.junit.Test;

public class VisionHeadingReadinessTest {
  @Test public void disagreeingCameraCannotEraseAnotherCamerasConfirmation() {
    var check = check();
    boolean confirmed = false;
    for (int i = 0; i < 25; i++) {
      double now = 10 + i * .02;
      confirmed |= check.observe("good", 1, now, now);
      assertFalse(check.observe("conflicting", 12, now, now));
    }
    assertTrue(confirmed);
    check.reset("conflicting");
    assertTrue(check.observe("good", 1, 10.5, 10.5));
    check.reset();
    assertFalse(check.observe("good", 1, 10.52, 10.52));
  }

  @Test public void differentCamerasCannotCombineInsufficientWindows() {
    var check = check();
    for (int i = 0; i < 5; i++) assertFalse(check.observe("a", 0, 10 + i * .02, 10 + i * .02));
    for (int i = 0; i < 5; i++) assertFalse(check.observe("b", 0, 10.1 + i * .02, 10.1 + i * .02));
    assertFalse(check.observe("a", 0, 10.4, 10.4));
  }

  private static VisionHeadingReadiness check() {
    return new VisionHeadingReadiness(VisionHeadingInitializationConfig.DEFAULT, .2, 5);
  }

  @Test public void requiresDistinctAcceptedFramesAcrossTheConfiguredWindow() {
    var check = check();
    for (int i = 0; i < 13; i++) assertFalse(check.observe(1, 10 + i * .02, 10 + i * .02));
    assertTrue(check.observe(-1, 10.26, 10.26));
    check.reset();
    for (int i = 0; i < 30; i++) assertFalse(check.observe(0, 11, 11.1));
  }

  @Test public void requiresBothFrameCountAndElapsedTime() {
    var check = check();
    assertFalse(check.observe(0, 10, 10));
    assertFalse(check.observe(0, 10.1, 10.1));
    assertFalse(check.observe(0, 10.2, 10.2));
    assertFalse(check.observe(0, 10.3, 10.3));
    assertTrue(check.observe(0, 10.32, 10.32));
  }

  @Test public void excessiveErrorInvalidFramesAndGapsRestartTheWindow() {
    for (double error : new double[] {5.01, -5.01, 90, Double.NaN, Double.POSITIVE_INFINITY}) {
      var check = check();
      for (int i = 0; i < 12; i++) check.observe(0, 10 + i * .02, 10 + i * .02);
      assertFalse(check.observe(error, 10.24, 10.24));
      assertFalse(check.observe(0, 10.26, 10.26));
    }
    var check = check();
    for (int i = 0; i < 12; i++) check.observe(0, 10 + i * .02, 10 + i * .02);
    assertFalse(check.observe(0, 10.6, 10.6));
    assertFalse(check.observe(0, 10.62, 11));
    assertFalse(check.observe(0, 12, 11));
    assertFalse(check.observe(0, Double.NaN, 11));
  }

  @Test public void outOfOrderFramesCannotCompleteTheWindow() {
    var check = check();
    for (int i = 0; i < 12; i++) check.observe(0, 10 + i * .02, 10 + i * .02);
    assertFalse(check.observe(0, 10.1, 10.26));
    assertFalse(check.observe(0, 10.24, 10.26));
    assertTrue(check.observe(0, 10.26, 10.26));
  }

  @Test public void usesTheConfiguredAgreementToleranceAndSampleWindow() {
    var config = new VisionHeadingInitializationConfig(true, .1, 3, .5, .05, 5, .5);
    var check = new VisionHeadingReadiness(config, .2, .5);
    assertFalse(check.observe(.51, 10, 10));
    assertFalse(check.observe(.5, 10.02, 10.02));
    assertFalse(check.observe(-.5, 10.08, 10.08));
    assertTrue(check.observe(.4, 10.14, 10.14));
  }

  @Test public void rejectsInvalidAgeLimits() {
    for (double age : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class,
          () -> new VisionHeadingReadiness(VisionHeadingInitializationConfig.DEFAULT, age, 5));
    }
  }

  @Test public void acceptsFiveDegreeBoundaryWithoutChangingDisabledInitializationSpread() {
    assertEquals(2, VisionHeadingInitializationConfig.DEFAULT.maxSpreadDegrees(), 0);
    var check = check();
    for (int i = 0; i < 13; i++) assertFalse(check.observe(i % 2 == 0 ? 5 : -5, 10 + i * .02, 10 + i * .02));
    assertTrue(check.observe(5, 10.26, 10.26));
  }

  @Test public void rejectsInvalidAgreementLimits() {
    for (double error : new double[] {0, -1, 181, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class,
          () -> new VisionHeadingReadiness(VisionHeadingInitializationConfig.DEFAULT, .2, error));
    }
  }
}
