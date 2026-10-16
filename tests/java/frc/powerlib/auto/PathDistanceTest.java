package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Translation2d;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class PathDistanceTest {
  @Test public void singleDestinationMatchesDirectDistance() {
    var destination = new Translation2d(3, 4);
    var path = new PathDistance(List.of(destination));
    assertEquals(5, path.remainingDistance(new Translation2d(), 0), 1e-9);
    assertEquals(Math.sqrt(8), path.remainingDistance(new Translation2d(1, 2), 0), 1e-9);
    assertEquals(0, path.remainingDistance(destination, 0), 0);
  }

  @Test public void sumsRemainingLegsRatherThanTakingAShortcutToTheEnd() {
    var path = new PathDistance(List.of(new Translation2d(3, 0), new Translation2d(3, 4), new Translation2d(6, 8)));
    assertEquals(12, path.remainingDistance(new Translation2d(), 0), 1e-9);
    assertEquals(11, path.remainingDistance(new Translation2d(1, 0), 0), 1e-9);
    assertEquals(9, path.remainingDistance(new Translation2d(3, 0), 1), 1e-9);
    assertEquals(5, path.remainingDistance(new Translation2d(3, 4), 2), 1e-9);
    assertEquals(0, path.remainingDistance(new Translation2d(6, 8), 2), 0);
  }

  @Test public void suppliedIndexControlsProgressEvenNearLaterDestinations() {
    var path = new PathDistance(List.of(new Translation2d(3, 0), new Translation2d(0, 3), new Translation2d(3, 3)));
    var position = new Translation2d(0, 3);
    assertEquals(2 * Math.sqrt(18) + 3, path.remainingDistance(position, 0), 1e-9);
    assertEquals(3, path.remainingDistance(position, 1), 1e-9);
    assertEquals(2 * Math.sqrt(18) + 3, path.remainingDistance(position, 0), 1e-9);
  }

  @Test public void offRouteMovementAndPoseCorrectionsAreRecalculated() {
    var path = new PathDistance(List.of(new Translation2d(3, 0), new Translation2d(3, 4)));
    assertEquals(6, path.remainingDistance(new Translation2d(1, 0), 0), 1e-9);
    assertEquals(9, path.remainingDistance(new Translation2d(0, 4), 0), 1e-9);
    assertEquals(5, path.remainingDistance(new Translation2d(2, 0), 0), 1e-9);
    assertEquals(6, path.remainingDistance(new Translation2d(5, 0), 0), 1e-9);
  }

  @Test public void repeatedPointsAndCallerListChangesDoNotCorruptCachedLengths() {
    var origin = new Translation2d();
    var points = new ArrayList<>(List.of(origin, origin, new Translation2d(3, 4), new Translation2d(3, 4)));
    var path = new PathDistance(points);
    points.clear();
    assertEquals(5, path.remainingDistance(origin, 0), 1e-9);
    assertEquals(5, path.remainingDistance(origin, 1), 1e-9);
    assertEquals(0, path.remainingDistance(new Translation2d(3, 4), 3), 0);
    assertEquals(0, new PathDistance(List.of(origin, origin)).remainingDistance(origin, 0), 0);
  }

  @Test public void invalidPathsPositionsAndIndicesFailExplicitly() {
    assertThrows(IllegalArgumentException.class, () -> new PathDistance(List.of()));
    assertThrows(NullPointerException.class, () -> new PathDistance(null));
    assertThrows(NullPointerException.class, () -> new PathDistance(Arrays.asList((Translation2d) null)));
    assertThrows(IllegalArgumentException.class, () -> new PathDistance(List.of(new Translation2d(Double.NaN, 0))));
    assertThrows(IllegalArgumentException.class, () -> new PathDistance(List.of(new Translation2d(0, Double.POSITIVE_INFINITY))));
    var path = new PathDistance(List.of(new Translation2d()));
    assertThrows(IndexOutOfBoundsException.class, () -> path.remainingDistance(new Translation2d(), -1));
    assertThrows(IndexOutOfBoundsException.class, () -> path.remainingDistance(new Translation2d(), 1));
    assertThrows(NullPointerException.class, () -> path.remainingDistance(null, 0));
    assertThrows(IllegalArgumentException.class, () -> path.remainingDistance(new Translation2d(0, Double.NaN), 0));
    assertEquals(0, path.remainingDistance(new Translation2d(), 0), 0);
  }

  @Test public void unrepresentableDistancesAreRejected() {
    var huge = new Translation2d(Double.MAX_VALUE, 0);
    var opposite = new Translation2d(-Double.MAX_VALUE, 0);
    assertThrows(IllegalArgumentException.class, () -> new PathDistance(List.of(huge, opposite)));
    var path = new PathDistance(List.of(huge));
    assertThrows(IllegalArgumentException.class, () -> path.remainingDistance(opposite, 0));
  }
}
