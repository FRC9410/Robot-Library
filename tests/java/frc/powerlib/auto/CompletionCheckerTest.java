package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import frc.powerlib.configs.CompletionCriteria;
import org.junit.Test;

public class CompletionCheckerTest {
  private static final Pose2d GOAL = new Pose2d(1, 2, Rotation2d.fromDegrees(179));
  private static final ChassisSpeeds STOPPED = new ChassisSpeeds();
  private static CompletionChecker checker(double settleTime) {
    return new CompletionChecker(new CompletionCriteria(0.1, Math.toRadians(3), 0.05, 0.1, settleTime));
  }

  @Test public void arrivalRequiresLowMeasuredTranslationAndRotationEvenWithoutHeadingLock() {
    var checker = checker(0);
    assertFalse(checker.update(GOAL, GOAL, new ChassisSpeeds(0.04, 0.04, 0), true, 1));
    assertFalse(checker.update(GOAL, GOAL, new ChassisSpeeds(0, 0, -0.11), false, 1));
    var wrongHeading = new Pose2d(GOAL.getTranslation(), Rotation2d.kZero);
    assertFalse(checker.update(wrongHeading, GOAL, STOPPED, true, 1));
    assertTrue(checker.update(wrongHeading, GOAL, STOPPED, false, 1));
    assertTrue(checker.update(GOAL, GOAL, new ChassisSpeeds(0.05, 0, 0.1), true, 1));
  }

  @Test public void headingWrapsAtPiAndPositionToleranceIsInclusive() {
    var checker = checker(0);
    assertTrue(checker.update(new Pose2d(1, 2, Rotation2d.fromDegrees(-179)), GOAL, STOPPED, true, 0));
    var origin = new Pose2d();
    assertTrue(checker.update(new Pose2d(0.1, 0, Rotation2d.kZero), origin, STOPPED, true, 0));
    assertFalse(checker.update(new Pose2d(0.101, 0, Rotation2d.kZero), origin, STOPPED, true, 0));
  }

  @Test public void settleWindowMustBeContinuousAndDuplicateTimesCannotAdvanceIt() {
    var checker = checker(0.1);
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 1));
    for (int i = 0; i < 10; i++) assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 1));
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 1.05));
    assertFalse(checker.update(GOAL, GOAL, new ChassisSpeeds(1, 0, 0), true, 1.06));
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 1.1));
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 1.15));
    assertTrue(checker.update(GOAL, GOAL, STOPPED, true, 1.21));
    assertFalse(checker.update(new Pose2d(), GOAL, STOPPED, true, 1.22));
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 1.3));
    checker.reset();
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 2));
  }

  @Test public void invalidFeedbackAndClockReversalBreakTheSettleWindow() {
    var checker = checker(0.1);
    for (double invalid : new double[] {-1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 1));
      assertFalse(checker.update(GOAL, GOAL, STOPPED, true, invalid));
      assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 2));
      checker.reset();
    }
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 3));
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 2));
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 2.01));
    assertFalse(checker.update(null, GOAL, STOPPED, true, 2.2));
    assertFalse(checker.update(GOAL, null, STOPPED, true, 2.3));
    assertFalse(checker.update(GOAL, GOAL, null, true, 2.4));
    assertFalse(checker.update(GOAL, GOAL, new ChassisSpeeds(Double.NaN, 0, 0), true, 2.5));
    assertFalse(checker.update(new Pose2d(Double.NaN, 2, Rotation2d.kZero), GOAL, STOPPED, true, 2.6));
    assertFalse(checker.update(GOAL, GOAL, STOPPED, true, 3));
    assertTrue(checker.update(GOAL, GOAL, STOPPED, true, 3.11));
  }

  @Test public void criteriaRejectInvalidUnitsAndThresholds() {
    for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> new CompletionCriteria(invalid, 0.1, 0.1, 0.1, 0));
      assertThrows(IllegalArgumentException.class, () -> new CompletionCriteria(0.1, invalid, 0.1, 0.1, 0));
      assertThrows(IllegalArgumentException.class, () -> new CompletionCriteria(0.1, 0.1, invalid, 0.1, 0));
      assertThrows(IllegalArgumentException.class, () -> new CompletionCriteria(0.1, 0.1, 0.1, invalid, 0));
    }
    for (double invalid : new double[] {-1, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> new CompletionCriteria(0.1, 0.1, 0.1, 0.1, invalid));
    }
    assertThrows(IllegalArgumentException.class, () -> new CompletionCriteria(0.1, Math.PI + 0.1, 0.1, 0.1, 0));
    assertThrows(NullPointerException.class, () -> new CompletionChecker(null));
  }
}
