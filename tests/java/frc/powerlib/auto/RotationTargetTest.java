package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import frc.powerlib.configs.CompletionCriteria;
import frc.powerlib.configs.MotionConstraints;
import frc.powerlib.configs.PathWaypoint;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

public class RotationTargetTest {
  private static final MotionConstraints LIMITS = new MotionConstraints(2, 1, 2, 1);
  private static final CompletionCriteria ARRIVAL = new CompletionCriteria(0.1, 0.1, 0.05, 0.1, 0.1);

  @Test public void fixedHeadingIsIndependentOfPositionAndRobotRotation() {
    var heading = Rotation2d.fromDegrees(-179);
    var target = RotationTarget.fixed(heading);
    assertTrue(target.enabled());
    assertSame(heading, target.resolve(new Pose2d(1, 2, Rotation2d.fromDegrees(90))));
    assertSame(heading, target.resolve(new Pose2d(-3, 4, Rotation2d.fromDegrees(-20))));
    assertEquals(2, heading.minus(Rotation2d.fromDegrees(179)).getDegrees(), 1e-9);
  }

  @Test public void facingAFieldPointTracksMovementAndSupportsARearOffset() {
    var point = new Translation2d(2, 3);
    var front = RotationTarget.facePoint(point);
    var rear = RotationTarget.facePoint(point, Rotation2d.fromDegrees(180));
    var west = new Pose2d(1, 3, Rotation2d.fromDegrees(90));
    var south = new Pose2d(2, 2, Rotation2d.fromDegrees(-30));
    assertEquals(0, front.resolve(west).getDegrees(), 1e-9);
    assertEquals(90, front.resolve(south).getDegrees(), 1e-9);
    assertEquals(180, Math.abs(rear.resolve(west).getDegrees()), 1e-9);
    assertEquals(-90, rear.resolve(south).getDegrees(), 1e-9);
    assertThrows(IllegalArgumentException.class, () -> front.resolve(new Pose2d(point, Rotation2d.kZero)));
  }

  @Test public void liveTargetUsesTheSuppliedPoseOncePerResolution() {
    var calls = new AtomicInteger();
    var pose = new Pose2d(2, 3, Rotation2d.kZero);
    var target = RotationTarget.live(current -> {
      assertSame(pose, current);
      calls.incrementAndGet();
      return Rotation2d.fromDegrees(15 * calls.get());
    });
    assertEquals(15, target.resolve(pose).getDegrees(), 1e-9);
    assertEquals(30, target.resolve(pose).getDegrees(), 1e-9);
    assertEquals(2, calls.get());
  }

  @Test public void rejectsUnavailableAndInvalidTargetsRatherThanReusingAnOldHeading() {
    var pose = new Pose2d();
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.fixed(null));
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.fixed(Rotation2d.fromRadians(Double.NaN)));
    assertThrows(NullPointerException.class, () -> RotationTarget.live(null));
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.facePoint(null));
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.facePoint(new Translation2d(Double.NaN, 0)));
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.facePoint(new Translation2d(), null));
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.live(current -> null).resolve(pose));
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.live(current ->
        Rotation2d.fromRadians(Double.POSITIVE_INFINITY)).resolve(pose));
    var broken = RotationTarget.live(current -> { throw new IllegalStateException("No target"); });
    assertTrue(assertThrows(IllegalArgumentException.class, () -> broken.resolve(pose)).getCause()
        instanceof IllegalStateException);
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.fixed(Rotation2d.kZero).resolve(null));
    assertThrows(IllegalArgumentException.class, () -> RotationTarget.facePoint(new Translation2d(Double.MAX_VALUE, 0))
        .resolve(new Pose2d(-Double.MAX_VALUE, 0, Rotation2d.kZero)));
  }

  @Test public void disabledPolicyCannotBeMistakenForAnEnabledZeroHeading() {
    assertFalse(RotationTarget.NONE.enabled());
    assertThrows(IllegalStateException.class, () -> RotationTarget.NONE.resolve(new Pose2d()));
  }

  @Test public void legacyWaypointsKeepTheirHeadingPolicyAndExplicitTargetsIgnorePoseRotation() {
    var pose = new Pose2d(1, 2, Rotation2d.fromDegrees(45));
    var locked = new PathWaypoint(pose, LIMITS, ARRIVAL, true, 3);
    var unlocked = new PathWaypoint(pose, LIMITS, ARRIVAL, false, 3);
    assertTrue(locked.lockHeading());
    assertEquals(45, locked.rotationTarget().resolve(new Pose2d()).getDegrees(), 1e-9);
    assertFalse(unlocked.lockHeading());
    assertSame(RotationTarget.NONE, unlocked.rotationTarget());
    var explicit = new PathWaypoint(pose, LIMITS, ARRIVAL, RotationTarget.fixed(Rotation2d.fromDegrees(90)), 3);
    assertTrue(explicit.lockHeading());
    assertEquals(90, explicit.rotationTarget().resolve(new Pose2d()).getDegrees(), 1e-9);
    assertThrows(NullPointerException.class, () -> new PathWaypoint(pose, LIMITS, ARRIVAL, null, 3));
  }

  @Test public void rotationPoliciesDoNotChangeGeometryBrakingOrIntermediateAdvancement() {
    var end = new Pose2d(4, 0, Rotation2d.kZero);
    var original = new PathProgress(List.of(new PathWaypoint(new Pose2d(2, 0, Rotation2d.kZero), LIMITS, ARRIVAL, true, 3),
        new PathWaypoint(end, LIMITS, ARRIVAL, false, 3)));
    var independent = new PathProgress(List.of(new PathWaypoint(new Pose2d(2, 0, Rotation2d.fromDegrees(90)),
        LIMITS, ARRIVAL, RotationTarget.facePoint(new Translation2d(3, 3)), 3),
        new PathWaypoint(end, LIMITS, ARRIVAL, RotationTarget.fixed(Rotation2d.fromDegrees(180)), 3)));
    original.reset(new Translation2d());
    independent.reset(new Translation2d());
    for (var position : List.of(new Translation2d(1, 0.1), new Translation2d(2, 0), new Translation2d(3.9, 0))) {
      assertEquals(original.advance(position), independent.advance(position));
      assertEquals(original.index(), independent.index());
      assertEquals(original.currentSegment().start(), independent.currentSegment().start());
      assertEquals(original.currentSegment().end(), independent.currentSegment().end());
      assertEquals(original.remainingDistance(position), independent.remainingDistance(position), 0);
      assertEquals(original.maxTranslationSpeed(position), independent.maxTranslationSpeed(position), 0);
    }
  }
}
