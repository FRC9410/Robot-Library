package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import frc.powerlib.configs.CompletionCriteria;
import frc.powerlib.configs.MotionConstraints;
import frc.powerlib.configs.PathWaypoint;
import frc.powerlib.configs.WaypointHandoffConfig;
import java.util.List;
import org.junit.Test;

public class WaypointHandoffTest {
  private static final WaypointHandoffConfig CROSSING = new WaypointHandoffConfig(true, 0.25, 0.5);
  private static PathWaypoint point(double x, double y, double radius) {
    return new PathWaypoint(new Pose2d(x, y, Rotation2d.kZero), new MotionConstraints(4, 1, 2, 3),
        new CompletionCriteria(radius, 0.1, 0.05, 0.1, 0.1), true, 3);
  }
  private static PathProgress straight() {
    var path = new PathProgress(List.of(point(1, 0, 0.1), point(3, 0, 0.1)), CROSSING);
    path.reset(new Translation2d());
    return path;
  }

  @Test public void aSkippedRadiusAdvancesOnAForwardCrossingAndCannotReplay() {
    var path = straight();
    assertFalse(path.advance(new Translation2d(0.8, 0)));
    assertTrue(path.advance(new Translation2d(1.2, 0)));
    assertEquals(1, path.index());
    assertFalse(path.advance(new Translation2d(1.2, 0)));
    assertFalse(path.advance(new Translation2d(0.8, 0)));
    assertEquals(1, path.index());
  }

  @Test public void diagonalCrossingsUseTheIncomingLegAndLateralIntersection() {
    var path = straight();
    path.reset(new Translation2d(0, 0));
    path.advance(new Translation2d(0.8, -0.08));
    assertTrue(path.advance(new Translation2d(1.2, 0.08)));

    path = new PathProgress(List.of(point(1, 1, 0.1), point(2, 2, 0.1)), CROSSING);
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.85, 0.85));
    assertTrue(path.advance(new Translation2d(1.15, 1.15)));
  }

  @Test public void excessiveLateralOffsetsAtEitherEndOrIntersectionCannotAdvance() {
    for (double[] sample : new double[][] {{0.2, 0.2}, {0.2, 0.06}, {0, 0.2}}) {
      var path = straight();
      path.advance(new Translation2d(0.8, sample[0]));
      assertFalse(path.advance(new Translation2d(1.2, sample[1])));
      assertEquals(0, path.index());
    }
    var sideways = straight();
    sideways.advance(new Translation2d(1, 0.2));
    assertFalse(sideways.advance(new Translation2d(1, 0.11)));
  }

  @Test public void backwardsMotionAndStartingBeyondThePlaneAreNotForwardCrossings() {
    var path = straight();
    assertFalse(path.advance(new Translation2d(1.2, 0))); // A jump from the seed exceeds the sample bound.
    assertFalse(path.advance(new Translation2d(0.8, 0)));
    assertEquals(0, path.index());
    assertTrue(path.advance(new Translation2d(1.2, 0)));

    var reversed = new PathProgress(List.of(point(1, 0, 0.1), point(0, 0, 0.1)), CROSSING);
    reversed.reset(new Translation2d(2, 0));
    reversed.advance(new Translation2d(1.2, 0));
    assertTrue(reversed.advance(new Translation2d(0.8, 0)));
  }

  @Test public void excessiveOvershootAndLargeJumpsAreRejectedAndConsumed() {
    var path = straight();
    path.advance(new Translation2d(0.85, 0));
    assertFalse(path.advance(new Translation2d(1.3, 0))); // Within sample bound, outside overshoot bound.
    assertFalse(path.advance(new Translation2d(1.3, 0)));
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.6, 0));
    assertFalse(path.advance(new Translation2d(1.2, 0))); // Within overshoot bound, outside sample bound.
    assertFalse(path.advance(new Translation2d(1.2, 0)));
    assertEquals(0, path.index());
    assertFalse(path.advance(new Translation2d(0.8, 0)));
    assertTrue(path.advance(new Translation2d(1.2, 0)));
  }

  @Test public void severalNearbyCrossingsAdvanceInOrderButAReversalCannotBeSkipped() {
    var path = new PathProgress(List.of(point(0.95, 0, 0.01), point(1, 0, 0.01),
        point(1.05, 0, 0.01), point(2, 0, 0.01)), CROSSING);
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.85, 0));
    assertTrue(path.advance(new Translation2d(1.15, 0)));
    assertEquals(3, path.index());

    path = new PathProgress(List.of(point(0.95, 0, 0.01), point(0.9, 0, 0.01),
        point(1.05, 0, 0.01), point(2, 0, 0.01)), CROSSING);
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.85, 0));
    assertTrue(path.advance(new Translation2d(1.15, 0)));
    assertEquals(1, path.index());
  }

  @Test public void anEarlierIntersectionOfTheNextPlaneCannotBeReusedAfterHandoff() {
    var path = new PathProgress(List.of(point(1, 0, 0.21), point(0.99, 0.13, 0.22),
        point(3, 0, 0.1)), CROSSING);
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.8, 0.1));
    assertTrue(path.advance(new Translation2d(1.2, 0.2)));
    assertEquals(1, path.index()); // The second plane was crossed earlier in this same sample.
  }

  @Test public void crossingBoundsAreInclusiveAndRadiusArrivalStillTrustsTheCurrentPose() {
    var path = straight();
    path.advance(new Translation2d(0.75, 0));
    assertTrue(path.advance(new Translation2d(1.25, 0)));
    path.reset(new Translation2d());
    assertTrue(path.advance(new Translation2d(1, 0))); // Large step, but directly inside the arrival radius.
  }

  @Test public void duplicatesRetainTheirOwnToleranceAndZeroLengthLeadingLegsAreSafe() {
    var path = new PathProgress(List.of(point(1, 0, 0.1), point(1, 0, 0.01), point(2, 0, 0.1)), CROSSING);
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.8, 0.05));
    assertTrue(path.advance(new Translation2d(1.2, 0.05)));
    assertEquals(1, path.index()); // The tight duplicate was not reached by this crossing.
    assertTrue(path.advance(new Translation2d(1, 0)));
    assertEquals(2, path.index());

    path = new PathProgress(List.of(point(1, 0, 0.1), point(1, 0, 0.1), point(2, 0, 0.1)), CROSSING);
    path.reset(new Translation2d(1, 0));
    assertTrue(path.advance(new Translation2d(1.2, 0)));
    assertEquals(2, path.index());
  }

  @Test public void crossingTheEndpointNeverCompletesOrAdvancesIt() {
    var path = new PathProgress(List.of(point(1, 0, 0.1)), CROSSING);
    path.reset(new Translation2d());
    assertFalse(path.advance(new Translation2d(0.8, 0)));
    assertFalse(path.advance(new Translation2d(1.2, 0)));
    assertEquals(0, path.index());
    assertTrue(path.atEndpoint());
    assertTrue(path.maxTranslationSpeed(new Translation2d(1.2, 0)) > 0);
  }

  @Test public void resetsAndInvalidSamplesClearCrossingEvidenceWithoutChangingLegOrder() {
    var path = straight();
    path.advance(new Translation2d(0.8, 0));
    assertThrows(IllegalArgumentException.class, () -> path.advance(new Translation2d(Double.NaN, 0)));
    assertFalse(path.advance(new Translation2d(1.2, 0)));
    assertEquals(0, path.index());
    path.reset();
    assertFalse(path.advance(new Translation2d(1.2, 0))); // No seed: this establishes history only.
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.8, 0));
    assertTrue(path.advance(new Translation2d(1.2, 0)));
    assertThrows(IllegalArgumentException.class, () -> path.reset(new Translation2d(Double.NaN, 0)));
    assertEquals(1, path.index());
  }

  @Test public void brakingBoundsCoverTheLargerHandoffRegionAndDoNotStopApproachEarly() {
    var points = List.of(point(1, 0, 0.1), point(2, 0, 0.1), point(3, 0, 0.1));
    var crossing = new PathProgress(points, CROSSING);
    var radiusOnly = new PathProgress(points);
    assertTrue(crossing.maxTranslationSpeed(new Translation2d(1, 0))
        < radiusOnly.maxTranslationSpeed(new Translation2d(1, 0)));
    assertTrue(crossing.maxTranslationSpeed(new Translation2d(0.8, 0)) > 0);
    var close = new PathProgress(List.of(point(1, 0, 0.01), point(1.1, 0, 0.2)), CROSSING);
    assertTrue(close.maxTranslationSpeed(new Translation2d(0.95, 0)) > 0);
    assertTrue(close.advance(new Translation2d(1, 0)));
    assertEquals(0, close.maxTranslationSpeed(new Translation2d(1, 0)), 0);
  }

  @Test public void radiusOnlyIsTheDefaultAndConfigurationRejectsInvalidBounds() {
    var path = new PathProgress(List.of(point(1, 0, 0.1), point(3, 0, 0.1)));
    path.reset(new Translation2d());
    path.advance(new Translation2d(0.8, 0));
    assertFalse(path.advance(new Translation2d(1.2, 0)));
    assertTrue(path.advance(new Translation2d(1, 0)));
    assertThrows(NullPointerException.class, () -> new PathProgress(List.of(point(1, 0, 0.1)), null));
    for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> new WaypointHandoffConfig(true, invalid, 0.5));
      assertThrows(IllegalArgumentException.class, () -> new WaypointHandoffConfig(true, 0.25, invalid));
    }
    assertEquals(new WaypointHandoffConfig(false, 0, 0), WaypointHandoffConfig.RADIUS_ONLY);
    assertThrows(IllegalArgumentException.class, () -> new WaypointHandoffConfig(false, Double.NaN, 0));
  }
}
