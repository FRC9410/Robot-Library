package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import org.junit.Test;

public class LegHeadingTest {
  private static final Rotation2d START = Rotation2d.fromDegrees(10);
  private static final Rotation2d END = Rotation2d.fromDegrees(90);

  @Test public void turnsToTheTargetRightAwayByDefault() {
    var heading = new LegHeading();
    assertEquals(90, heading.target(Translation2d.kZero, 0, START, END).getDegrees(), 1e-9);
  }

  @Test public void holdsTheStartingHeadingUntilTheTurnStarts() {
    var heading = new LegHeading();
    heading.turnAfter(0.6);
    assertEquals(10, heading.target(Translation2d.kZero, 0.59, START, END).getDegrees(), 1e-9);
    assertEquals(90, heading.target(Translation2d.kZero, 0.6, START, END).getDegrees(), 1e-9);
  }

  @Test public void facesThePointFromWhereverTheRobotIs() {
    var heading = new LegHeading();
    heading.face(new Translation2d(4, 4));
    assertTrue(heading.isFacing());
    assertEquals(45, heading.target(Translation2d.kZero, 0, START, END).getDegrees(), 1e-9);
    assertEquals(90, heading.target(new Translation2d(4, 0), 0.5, START, END).getDegrees(), 1e-9);
    // On top of the point there is no direction, so the last one holds.
    assertEquals(90, heading.target(new Translation2d(4, 4), 1, START, END).getDegrees(), 1e-9);
    heading.reset();
    assertEquals(90, heading.target(new Translation2d(4, 4), 1, START, END).getDegrees(), 1e-9);
  }

  @Test public void rejectsInvalidSettings() {
    var heading = new LegHeading();
    assertThrows(IllegalArgumentException.class, () -> heading.turnAfter(1.5));
    assertThrows(IllegalArgumentException.class, () -> heading.face(new Translation2d(Double.NaN, 0)));
    assertThrows(NullPointerException.class, () -> heading.face(null));
  }
}
