package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Translation2d;
import org.junit.Test;

public class DriveToPoseControllerTest {
  private static final double DT = DriveToPoseController.LOOP_PERIOD_SECONDS;

  /** Ideal tracking: the robot moves at exactly the commanded velocity, as the Auto Builder replay assumes. */
  private static final class Leg {
    Translation2d position;
    Translation2d velocity;
    int cycles;
    double peakSpeed;
    double peakAcceleration;

    Leg(Translation2d position, Translation2d velocity) {
      this.position = position;
      this.velocity = velocity;
    }

    Leg run(Translation2d target, DriveConstraints constraints) {
      var controller = new DriveToPoseController(constraints);
      controller.reset(velocity);
      cycles = 0;
      while (!controller.atGoal(position, velocity, target)) {
        Translation2d next = controller.calculate(position, target);
        peakAcceleration = Math.max(peakAcceleration, next.minus(velocity).getNorm() / DT);
        velocity = next;
        peakSpeed = Math.max(peakSpeed, velocity.getNorm());
        position = position.plus(velocity.times(DT));
        assertTrue("Leg did not finish", ++cycles < 2000);
      }
      return this;
    }
  }

  @Test public void reachesTargetWithinLimits() {
    var constraints = new DriveConstraints(3.0, 3.0, 0.05, 0.1);
    Leg leg = new Leg(Translation2d.kZero, Translation2d.kZero).run(new Translation2d(3, 0), constraints);
    assertEquals(3.0, leg.position.getX(), 0.05);
    assertEquals(0.0, leg.position.getY(), 1e-9);
    assertTrue(leg.peakSpeed <= 3.0 + 1e-9);
    assertTrue(leg.peakAcceleration <= 3.0 + 1e-6);
    assertTrue(leg.velocity.getNorm() <= 0.1);
    // Shared with scripts/auto-builder-check.mjs so the replay matches the robot.
    assertEquals(99, leg.cycles);
  }

  @Test public void respectsLowerSpeedLimit() {
    Leg leg = new Leg(Translation2d.kZero, Translation2d.kZero)
        .run(new Translation2d(4, 3), new DriveConstraints(1.5, 4.0, 0.05, 0.1));
    assertTrue(leg.peakSpeed <= 1.5 + 1e-9);
    assertTrue(leg.position.getDistance(new Translation2d(4, 3)) <= 0.05);
  }

  @Test public void looseTolerancesReleaseWhileMovingAndBlendIntoNextLeg() {
    var corner = new DriveConstraints(3.0, 3.0, 0.5, 3.0);
    Leg leg = new Leg(Translation2d.kZero, Translation2d.kZero).run(new Translation2d(3, 0), corner);
    double releaseSpeed = leg.velocity.getNorm();
    assertTrue("Loose tolerances should release while moving", releaseSpeed > 1.0);
    assertTrue(leg.position.getDistance(new Translation2d(3, 0)) <= 0.5);

    // The next leg starts from the carried velocity, so the turn is limited by acceleration.
    leg.peakAcceleration = 0;
    leg.run(new Translation2d(3, 3), DriveConstraints.DEFAULT);
    assertTrue(leg.peakAcceleration <= 3.0 + 1e-6);
    assertTrue(leg.position.getDistance(new Translation2d(3, 3)) <= 0.05);
  }

  @Test public void finishesOnlyInsideBothTolerances() {
    var controller = new DriveToPoseController(new DriveConstraints(3.0, 3.0, 0.1, 0.2));
    Translation2d target = new Translation2d(1, 1);
    assertTrue(controller.atGoal(new Translation2d(1.05, 1), new Translation2d(0.1, 0), target));
    assertFalse(controller.atGoal(new Translation2d(1.05, 1), new Translation2d(0.5, 0), target));
    assertFalse(controller.atGoal(new Translation2d(1.5, 1), Translation2d.kZero, target));
  }

  @Test public void rejectsInvalidConstraints() {
    assertThrows(IllegalArgumentException.class, () -> new DriveConstraints(0, 3, 0.05, 0.1));
    assertThrows(IllegalArgumentException.class, () -> new DriveConstraints(3, Double.NaN, 0.05, 0.1));
    assertThrows(IllegalArgumentException.class, () -> new DriveConstraints(3, 3, 0, 0.1));
    assertThrows(IllegalArgumentException.class, () -> new DriveConstraints(3, 3, 0.05, -1));
  }
}
