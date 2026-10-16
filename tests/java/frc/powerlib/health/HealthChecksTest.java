package frc.powerlib.health;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import org.junit.Test;

public class HealthChecksTest {
  @Test public void invalidMeasuredSpeedsAreUnhealthy() {
    assertTrue(HealthChecks.finiteSpeeds(new ChassisSpeeds(1, -2, 3)));
    assertFalse(HealthChecks.finiteSpeeds(null));
    for (double invalid : new double[] {Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY}) {
      assertFalse(HealthChecks.finiteSpeeds(new ChassisSpeeds(invalid, 0, 0)));
      assertFalse(HealthChecks.finiteSpeeds(new ChassisSpeeds(0, invalid, 0)));
      assertFalse(HealthChecks.finiteSpeeds(new ChassisSpeeds(0, 0, invalid)));
    }
  }

  @Test public void freshnessRejectsStaleFutureAndInvalidTimes() {
    assertTrue(HealthChecks.isFresh(0, 0.5));
    assertTrue(HealthChecks.isFresh(0.5, 0.5));
    assertFalse(HealthChecks.isFresh(0.500001, 0.5));
    for (double invalid : new double[] {-0.01, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertFalse(HealthChecks.isFresh(invalid, 0.5));
      assertFalse(HealthChecks.isFresh(0, invalid));
    }
  }

  @Test public void invalidPosesAndMissingFeedbackAreUnhealthy() {
    assertTrue(HealthChecks.finitePose(new Pose2d(2, 4, Rotation2d.fromDegrees(30))));
    assertFalse(HealthChecks.finitePose(null));
    assertFalse(HealthChecks.finitePose(new Pose2d(Double.NaN, 4, new Rotation2d())));
    assertFalse(HealthChecks.finitePose(new Pose2d(2, Double.POSITIVE_INFINITY, new Rotation2d())));
    assertFalse(HealthChecks.signalHealthy(null, 0.5));
    assertFalse(HealthChecks.mechanismHealthy(null, null, 0.5));
    assertFalse(HealthChecks.driveHealthy(null, 0.5));
  }
}
