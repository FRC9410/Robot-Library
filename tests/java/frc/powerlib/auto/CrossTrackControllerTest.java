package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import frc.powerlib.configs.CompletionCriteria;
import frc.powerlib.configs.CrossTrackConfig;
import frc.powerlib.configs.MotionConstraints;
import frc.powerlib.configs.PathWaypoint;
import java.util.List;
import org.junit.Test;

public class CrossTrackControllerTest {
  private static final PathProgress.Segment LINE = new PathProgress.Segment(new Translation2d(), new Translation2d(10, 0));
  private static final CrossTrackConfig CONFIG = new CrossTrackConfig(1.5, 0.75);

  @Test public void followsTheLineAndCorrectsTowardItFromEitherSideWithoutChangingOmega() {
    var controller = new CrossTrackController(CONFIG);
    var request = new ChassisSpeeds(0, 0, 1.23);
    controller.calculate(LINE, new Translation2d(2, 0), 2, request);
    assertEquals(2, request.vxMetersPerSecond, 1e-9);
    assertEquals(0, request.vyMetersPerSecond, 0);
    controller.calculate(LINE, new Translation2d(2, 0.5), 2, request);
    assertTrue(request.vxMetersPerSecond > 0);
    assertTrue(request.vyMetersPerSecond < 0);
    double correction = request.vyMetersPerSecond;
    controller.calculate(LINE, new Translation2d(2, -0.5), 2, request);
    assertEquals(-correction, request.vyMetersPerSecond, 1e-9);
    assertEquals(1.23, request.omegaRadiansPerSecond, 0);
  }

  @Test public void horizontalVerticalDiagonalAndReversedFramesProduceTheSameRotatedRequest() {
    var controller = new CrossTrackController(CONFIG);
    var baseline = new ChassisSpeeds();
    controller.calculate(LINE, new Translation2d(2, 0.5), 2, baseline);
    var origin = new Translation2d(3, -2);
    for (double angle : new double[] {0, 45, 90, 180, -90}) {
      var rotation = Rotation2d.fromDegrees(angle);
      var segment = new PathProgress.Segment(origin, origin.plus(LINE.end().rotateBy(rotation)));
      var position = origin.plus(new Translation2d(2, 0.5).rotateBy(rotation));
      var request = new ChassisSpeeds();
      controller.calculate(segment, position, 2, request);
      var expected = new Translation2d(baseline.vxMetersPerSecond, baseline.vyMetersPerSecond).rotateBy(rotation);
      assertEquals(expected.getX(), request.vxMetersPerSecond, 1e-9);
      assertEquals(expected.getY(), request.vyMetersPerSecond, 1e-9);
    }
  }

  @Test public void boundsLateralCorrectionAndTheCompleteVectorIncludingSmallSpeedBudgets() {
    var controller = new CrossTrackController(CONFIG);
    var request = new ChassisSpeeds();
    for (double speed : new double[] {0, 0.1, 0.5, 2}) {
      for (double y : new double[] {0.01, 0.5, 1000, -1000}) {
        controller.calculate(LINE, new Translation2d(2, y), speed, request);
        assertTrue(Math.hypot(request.vxMetersPerSecond, request.vyMetersPerSecond) <= speed + 1e-9);
        assertTrue(Math.abs(request.vyMetersPerSecond) <= 0.75 + 1e-9);
        assertTrue(request.vyMetersPerSecond * y <= 0);
      }
    }
    controller.calculate(LINE, new Translation2d(9.9, 0.5), 2, request);
    assertTrue(request.vxMetersPerSecond < 0.5); // Slow forward motion while recovering near the arrival plane.
    assertEquals(-0.75, request.vyMetersPerSecond, 1e-9);
  }

  @Test public void disabledCorrectionRetainsDirectPointSteering() {
    var position = new Translation2d(2, 0.5);
    var expected = LINE.end().minus(position);
    for (var config : List.of(CrossTrackConfig.DISABLED, new CrossTrackConfig(0, 1), new CrossTrackConfig(1, 0))) {
      var request = new ChassisSpeeds();
      new CrossTrackController(config).calculate(LINE, position, 2, request);
      assertEquals(expected.getX() / expected.getNorm() * 2, request.vxMetersPerSecond, 1e-9);
      assertEquals(expected.getY() / expected.getNorm() * 2, request.vyMetersPerSecond, 1e-9);
    }
  }

  @Test public void directRecoveryHandlesBeforeStartAfterEndZeroLengthAndExactArrival() {
    var controller = new CrossTrackController(CONFIG);
    var request = new ChassisSpeeds();
    for (var segment : List.of(LINE, new PathProgress.Segment(LINE.end(), LINE.end()))) {
      for (var position : List.of(new Translation2d(-1, 1), new Translation2d(10.2, 0.3),
          new Translation2d(11, -0.3), LINE.end())) {
        controller.calculate(segment, position, 2, request);
        var delta = segment.end().minus(position);
        assertEquals(delta.getNorm() == 0 ? 0 : 2,
            Math.hypot(request.vxMetersPerSecond, request.vyMetersPerSecond), 1e-9);
        assertEquals(0, request.vxMetersPerSecond * delta.getY() - request.vyMetersPerSecond * delta.getX(), 1e-9);
        assertTrue(request.vxMetersPerSecond * delta.getX() + request.vyMetersPerSecond * delta.getY() >= 0);
      }
    }
  }

  @Test public void rejectsInvalidInputsWithoutChangingTheRequest() {
    var controller = new CrossTrackController(CONFIG);
    var request = new ChassisSpeeds(1, 2, 3);
    for (double invalid : new double[] {-1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> controller.calculate(LINE, new Translation2d(), invalid, request));
    }
    for (var invalid : new Translation2d[] {null, new Translation2d(Double.NaN, 0),
        new Translation2d(0, Double.POSITIVE_INFINITY), new Translation2d(-Double.MAX_VALUE, -Double.MAX_VALUE)}) {
      assertThrows(IllegalArgumentException.class, () -> controller.calculate(LINE, invalid, 2, request));
    }
    assertThrows(NullPointerException.class, () -> controller.calculate(null, new Translation2d(), 2, request));
    assertThrows(NullPointerException.class, () -> controller.calculate(LINE, new Translation2d(), 2, null));
    assertEquals(1, request.vxMetersPerSecond, 0);
    assertEquals(2, request.vyMetersPerSecond, 0);
    assertEquals(3, request.omegaRadiansPerSecond, 0);
    assertThrows(IllegalArgumentException.class, () -> new PathProgress.Segment(null, new Translation2d()));
    assertThrows(IllegalArgumentException.class, () -> new PathProgress.Segment(
        new Translation2d(-Double.MAX_VALUE, 0), new Translation2d(Double.MAX_VALUE, 0)));
  }

  @Test public void validatesConfigurationAndSaturatesAnOverflowingProportionalProduct() {
    assertFalse(CrossTrackConfig.DISABLED.enabled());
    assertTrue(CONFIG.enabled());
    for (double invalid : new double[] {-1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> new CrossTrackConfig(invalid, 1));
      assertThrows(IllegalArgumentException.class, () -> new CrossTrackConfig(1, invalid));
    }
    assertThrows(NullPointerException.class, () -> new CrossTrackController(null));
    var request = new ChassisSpeeds();
    new CrossTrackController(new CrossTrackConfig(Double.MAX_VALUE, 0.5))
        .calculate(LINE, new Translation2d(2, 2), 2, request);
    assertTrue(request.vyMetersPerSecond < 0);
    assertTrue(Math.abs(request.vyMetersPerSecond) <= 0.5);
    assertTrue(Math.hypot(request.vxMetersPerSecond, request.vyMetersPerSecond) <= 2 + 1e-9);
  }

  @Test public void integratedMotionReducesLateralErrorAndSettlesWithinExistingMotionLimits() {
    var limits = new MotionConstraints(2, 2, 2, 2);
    var criteria = new CompletionCriteria(0.05, 0.1, 0.05, 0.1, 0.1);
    var goal = new Pose2d(10, 0, Rotation2d.kZero);
    var progress = new PathProgress(List.of(new PathWaypoint(goal, limits, criteria, true, 20)));
    progress.reset(new Translation2d());
    var steering = new CrossTrackController(CONFIG);
    var limiter = new ChassisMotionLimiter(limits);
    limiter.reset(new ChassisSpeeds());
    var completion = new CompletionChecker(criteria);
    var position = new Translation2d(1, 1); // A lateral disturbance after the planned segment was anchored.
    var desired = new ChassisSpeeds();
    var previous = new ChassisSpeeds();
    double time = 0;
    boolean finished = false;
    double largestLateError = 0;
    try (var distance = new DistanceSpeedController(new PIDController(3.2, 0, 0.2), 0.0762)) {
      for (int tick = 0; tick < 750 && !finished; tick++) {
        double dt = new double[] {0.01, 0.02, 0.03}[tick % 3];
        double speed = Math.min(progress.maxTranslationSpeed(position),
            distance.calculateStopping(progress.remainingDistance(position), 0.2, criteria.translationToleranceMeters(), limits));
        steering.calculate(progress.currentSegment(), position, speed, desired);
        var request = limiter.calculate(desired, dt);
        assertTrue(Math.hypot(request.vxMetersPerSecond, request.vyMetersPerSecond) <= 2 + 1e-9);
        assertTrue(Math.hypot(request.vxMetersPerSecond - previous.vxMetersPerSecond,
            request.vyMetersPerSecond - previous.vyMetersPerSecond) <= 2 * dt + 1e-9);
        position = position.plus(new Translation2d(request.vxMetersPerSecond * dt, request.vyMetersPerSecond * dt));
        time += dt;
        if (time >= 3) largestLateError = Math.max(largestLateError, Math.abs(position.getY()));
        finished = completion.update(new Pose2d(position, Rotation2d.kZero), goal, request, true, time);
        previous = request;
      }
    }
    assertTrue("Lateral error should recover from 1 m to less than 0.15 m", largestLateError < 0.15);
    assertTrue("The corrected move must still settle at its endpoint", finished);
    assertTrue(position.getDistance(goal.getTranslation()) <= criteria.translationToleranceMeters());
  }
}
