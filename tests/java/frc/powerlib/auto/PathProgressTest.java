package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import frc.powerlib.configs.CompletionCriteria;
import frc.powerlib.configs.MotionConstraints;
import frc.powerlib.configs.PathWaypoint;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public class PathProgressTest {
  private static final CompletionCriteria ARRIVAL = new CompletionCriteria(0.1, 0.1, 0.05, 0.1, 0.1);
  private static PathWaypoint point(double x, double speed) {
    return new PathWaypoint(new Pose2d(x, 0, Rotation2d.kZero), new MotionConstraints(speed, 1, 2, 3),
        ARRIVAL, true, 3);
  }

  @Test public void tracksOrderedTargetsAndRemainingDistanceWithoutCompletingAtIntermediatePoints() {
    var path = new PathProgress(List.of(point(1, 2), point(3, 2), point(5, 2)));
    assertEquals(5, path.remainingDistance(new Translation2d()), 1e-9);
    assertFalse(path.advance(new Translation2d(1.2, 0)));
    assertEquals(0, path.index()); // Overshooting is not a crossing rule in this version.
    assertTrue(path.advance(new Translation2d(1, 0)));
    assertEquals(1, path.index());
    assertEquals(4, path.remainingDistance(new Translation2d(1, 0)), 1e-9);
    assertFalse(path.atEndpoint());
    assertTrue(path.advance(new Translation2d(3, 0)));
    assertTrue(path.atEndpoint());
    assertFalse(path.advance(new Translation2d(5, 0)));
    assertEquals(2, path.index());
  }

  @Test public void duplicatesAdvanceInOneUpdateAndResetRestoresTheFirstTarget() {
    var path = new PathProgress(List.of(point(1, 2), point(1, 1), point(1, 0.5)));
    assertTrue(path.advance(new Translation2d(1, 0)));
    assertEquals(2, path.index());
    assertEquals(0.5, path.current().constraints().maxVelocityMetersPerSecond(), 0);
    assertEquals(0, path.maxTranslationSpeed(new Translation2d(1, 0)), 0);
    path.reset();
    assertEquals(0, path.index());
    assertFalse(path.atEndpoint());
  }

  @Test public void retainsSpeedAtAnIntermediatePointAndBrakesForALowerFollowingLimit() {
    var path = new PathProgress(List.of(point(10, 4), point(20, 1)));
    assertEquals(4, path.maxTranslationSpeed(new Translation2d()), 1e-9);
    double approaching = path.maxTranslationSpeed(new Translation2d(9.5, 0));
    assertEquals(Math.sqrt(1 + 2 * 0.4), approaching, 1e-9);
    assertTrue(approaching > 1 && approaching < 4);
    assertEquals(1, path.maxTranslationSpeed(new Translation2d(10, 0)), 1e-9);
    path.advance(new Translation2d(10, 0));
    assertEquals(1, path.maxTranslationSpeed(new Translation2d(10, 0)), 1e-9);
    assertEquals(Math.sqrt(0.2), path.maxTranslationSpeed(new Translation2d(19.8, 0)), 1e-9);
    assertEquals(0, path.maxTranslationSpeed(new Translation2d(20, 0)), 0);
  }

  @Test public void brakingAccountsForLimitsBeyondTheNextWaypointAndOverlappingTolerances() {
    var path = new PathProgress(List.of(point(10, 4), point(10.2, 4), point(20, 0.5)));
    assertEquals(0.5, path.maxTranslationSpeed(new Translation2d(10, 0)), 1e-7);
    var overlapping = new PathProgress(List.of(point(1, 4), point(1.1, 4)));
    assertEquals(0, overlapping.maxTranslationSpeed(new Translation2d(1, 0)), 0);
  }

  @Test public void singlePointMatchesStoppingEnvelopeAndUsesConservativeSectionConstraints() {
    var source = new ArrayList<>(List.of(point(1, 4), new PathWaypoint(
        new Pose2d(3, 0, Rotation2d.kZero), new MotionConstraints(1, 0.5, 1, 2), ARRIVAL, false, 1)));
    var path = new PathProgress(source);
    source.clear();
    assertEquals(new MotionConstraints(4, 0.5, 1, 2), path.constraints());
    assertEquals(1, path.endpoint().timeoutSeconds(), 0);
    var single = new PathProgress(List.of(point(1, 4)));
    assertTrue(single.atEndpoint());
    assertEquals(Math.sqrt(1.8), single.maxTranslationSpeed(new Translation2d()), 1e-9);
  }

  @Test public void invalidInputIsRejectedWithoutAdvancing() {
    assertThrows(IllegalArgumentException.class, () -> new PathProgress(List.of()));
    assertThrows(NullPointerException.class, () -> new PathProgress(null));
    var path = new PathProgress(List.of(point(1, 2), point(3, 2)));
    for (var invalid : new Translation2d[] {null, new Translation2d(Double.NaN, 0),
        new Translation2d(0, Double.POSITIVE_INFINITY)}) {
      assertThrows(IllegalArgumentException.class, () -> path.advance(invalid));
      assertThrows(IllegalArgumentException.class, () -> path.maxTranslationSpeed(invalid));
    }
    assertEquals(0, path.index());
    var valid = point(1, 2);
    assertThrows(IllegalArgumentException.class, () -> new PathWaypoint(null, valid.constraints(), ARRIVAL, true, 3));
    assertThrows(NullPointerException.class, () -> new PathWaypoint(valid.pose(), null, ARRIVAL, true, 3));
    assertThrows(NullPointerException.class, () -> new PathWaypoint(valid.pose(), valid.constraints(), null, true, 3));
    for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> new PathWaypoint(valid.pose(), valid.constraints(), ARRIVAL, true, invalid));
    }
  }
}
