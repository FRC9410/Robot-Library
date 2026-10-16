package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import frc.powerlib.configs.MotionConstraints;
import org.junit.Test;

public class ChassisMotionLimiterTest {
  private static final MotionConstraints LIMITS = new MotionConstraints(4, 2, 3, 5);

  private static double magnitude(ChassisSpeeds speeds) {
    return Math.hypot(speeds.vxMetersPerSecond, speeds.vyMetersPerSecond);
  }

  private static void assertSpeeds(double vx, double vy, double omega, ChassisSpeeds actual) {
    assertEquals(vx, actual.vxMetersPerSecond, 1e-9);
    assertEquals(vy, actual.vyMetersPerSecond, 1e-9);
    assertEquals(omega, actual.omegaRadiansPerSecond, 1e-9);
  }

  @Test public void diagonalMotionRespectsVectorVelocityAndAcceleration() {
    var limiter = new ChassisMotionLimiter(LIMITS);
    var desired = new ChassisSpeeds(10, 10, 10);
    var first = limiter.calculate(desired, 0.1);
    assertEquals(0.2, magnitude(first), 1e-9);
    assertEquals(first.vxMetersPerSecond, first.vyMetersPerSecond, 1e-9);
    assertEquals(0.5, first.omegaRadiansPerSecond, 1e-9);
    for (int i = 0; i < 100; i++) {
      var next = limiter.calculate(desired, 0.02);
      assertTrue(magnitude(next) <= 4 + 1e-9);
      assertTrue(Math.hypot(next.vxMetersPerSecond - first.vxMetersPerSecond,
          next.vyMetersPerSecond - first.vyMetersPerSecond) <= 0.04 + 1e-9);
      assertTrue(Math.abs(next.omegaRadiansPerSecond - first.omegaRadiansPerSecond) <= 0.1 + 1e-9);
      first = next;
    }
    assertEquals(4, magnitude(first), 1e-9);
    assertEquals(3, first.omegaRadiansPerSecond, 1e-9);
    assertSpeeds(10, 10, 10, desired);
  }

  @Test public void directionChangesBrakingAndReversalsShareTheSameVectorLimit() {
    var limiter = new ChassisMotionLimiter(LIMITS);
    limiter.reset(new ChassisSpeeds(2, 0, 2));
    var corner = limiter.calculate(new ChassisSpeeds(0, 2, -2), 0.1);
    assertEquals(0.2, Math.hypot(corner.vxMetersPerSecond - 2, corner.vyMetersPerSecond), 1e-9);
    assertEquals(1.5, corner.omegaRadiansPerSecond, 1e-9);
    limiter.reset(new ChassisSpeeds(2, 0, 2));
    assertSpeeds(1.8, 0, 1.5, limiter.calculate(new ChassisSpeeds(), 0.1));
    limiter.reset(new ChassisSpeeds(2, 0, 2));
    assertSpeeds(1.8, 0, 1.5, limiter.calculate(new ChassisSpeeds(-2, 0, -2), 0.1));
  }

  @Test public void resetSeedsMovingCommandsAndClampsInitiallyExcessiveSpeeds() {
    var limiter = new ChassisMotionLimiter(LIMITS);
    limiter.reset(new ChassisSpeeds(1, 0, 1));
    assertSpeeds(1.2, 0, 1.5, limiter.calculate(new ChassisSpeeds(3, 0, 2), 0.1));
    limiter.reset(new ChassisSpeeds(6, 8, -10));
    var held = limiter.calculate(new ChassisSpeeds(), 0);
    assertSpeeds(2.4, 3.2, -3, held);
    held.vxMetersPerSecond = 100; // Returned values cannot mutate limiter history.
    assertSpeeds(2.4, 3.2, -3, limiter.calculate(new ChassisSpeeds(), 0));
    limiter.reset(new ChassisSpeeds());
    assertSpeeds(0, 0, 0, limiter.calculate(new ChassisSpeeds(), 0));
  }

  @Test public void elapsedTimeControlsTheRampAndSmallTargetsDoNotOvershoot() {
    var varied = new ChassisMotionLimiter(LIMITS);
    var fixed = new ChassisMotionLimiter(LIMITS);
    var target = new ChassisSpeeds(4, 0, 3);
    for (double dt : new double[] {0.01, 0.03, 0.06}) varied.calculate(target, dt);
    assertSpeeds(0.2, 0, 0.5, varied.calculate(target, 0));
    assertSpeeds(0.2, 0, 0.5, fixed.calculate(target, 0.1));
    varied.reset(new ChassisSpeeds());
    assertSpeeds(0.01, -0.02, -0.03, varied.calculate(new ChassisSpeeds(0.01, -0.02, -0.03), 0.1));
    assertSpeeds(4, 0, 3, varied.calculate(target, 10));
  }

  @Test public void invalidInputsFailWithoutChangingAcceptedState() {
    var limiter = new ChassisMotionLimiter(LIMITS);
    limiter.reset(new ChassisSpeeds(1, 0, 1));
    for (double invalid : new double[] {-1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> limiter.calculate(new ChassisSpeeds(), invalid));
    }
    for (var invalid : new ChassisSpeeds[] {new ChassisSpeeds(Double.NaN, 0, 0),
        new ChassisSpeeds(0, Double.POSITIVE_INFINITY, 0), new ChassisSpeeds(0, 0, Double.NaN)}) {
      assertThrows(IllegalArgumentException.class, () -> limiter.calculate(invalid, 0.02));
      assertThrows(IllegalArgumentException.class, () -> limiter.reset(invalid));
    }
    assertThrows(NullPointerException.class, () -> limiter.reset(null));
    assertSpeeds(1, 0, 1, limiter.calculate(new ChassisSpeeds(), 0));
  }

  @Test public void allConstraintValuesMustBePositiveAndFinite() {
    for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> new MotionConstraints(invalid, 2, 3, 5));
      assertThrows(IllegalArgumentException.class, () -> new MotionConstraints(4, invalid, 3, 5));
      assertThrows(IllegalArgumentException.class, () -> new MotionConstraints(4, 2, invalid, 5));
      assertThrows(IllegalArgumentException.class, () -> new MotionConstraints(4, 2, 3, invalid));
    }
    assertThrows(NullPointerException.class, () -> new ChassisMotionLimiter(null));
  }
}
