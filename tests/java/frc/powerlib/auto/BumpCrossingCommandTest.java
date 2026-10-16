package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj2.command.Subsystem;
import frc.powerlib.auto.BumpCrossingCommand.Phase;
import frc.powerlib.configs.BumpCrossingConfig;
import frc.powerlib.configs.MotionConstraints;
import java.util.ArrayList;
import java.util.List;
import org.junit.Before;
import org.junit.Test;

public class BumpCrossingCommandTest {
  @Before public void initializeHal() { assertTrue(HAL.initialize(500, 0)); }

  private static BumpCrossingConfig config(boolean vision) {
    return new BumpCrossingConfig(new MotionConstraints(1, 1, 1, 2), 0.6, 8, 3,
        0.06, 0.12, 0.24, 6, 1, 0.05, 0.1, vision);
  }

  private static final class Fixture implements BumpCrossingCommand.Drive {
    final Subsystem drivetrain = new Subsystem() {};
    final List<String> failures = new ArrayList<>();
    final List<Phase> phases = new ArrayList<>();
    final BumpCrossingCommand command;
    double now = 10;
    double pitch;
    double roll;
    double yaw;
    double age;
    double visionTimestamp = Double.NEGATIVE_INFINITY;
    boolean healthy = true;
    boolean freshVision;
    ChassisSpeeds measured = new ChassisSpeeds();
    ChassisSpeeds request = new ChassisSpeeds();
    int stops;
    int reads;

    Fixture(boolean vision, boolean reversed) {
      command = new BumpCrossingCommand(drivetrain, this, config(vision), reversed, failures::add, () -> now);
    }

    @Override public void readInputs(BumpCrossingCommand.Inputs inputs) {
      reads++;
      inputs.healthy = healthy;
      inputs.yawRadians = yaw;
      inputs.pitchDegrees = pitch;
      inputs.rollDegrees = roll;
      inputs.signalAgeSeconds = age;
      inputs.robotSpeeds = measured;
      inputs.visionPositionTimestampSeconds = freshVision ? now - 0.001 : visionTimestamp;
    }
    @Override public void resetHeadingController() {}
    @Override public double headingRate(Rotation2d current, Rotation2d target) {
      return 4 * MathUtil.angleModulus(target.getRadians() - current.getRadians());
    }
    @Override public void applyRobotSpeeds(ChassisSpeeds speeds) {
      request = speeds;
      measured = speeds; // Deterministic ideal velocity response; no wheel positions are supplied.
    }
    @Override public void stop() { stops++; request = measured = new ChassisSpeeds(); }
    @Override public void recordPhase(Phase phase) { phases.add(phase); }

    void step() { now += 0.02; command.execute(); }
    void tilt(double value, int ticks) {
      pitch = value;
      for (int i = 0; i < ticks; i++) step();
    }
    void reachClearance(boolean reversed) {
      tilt(reversed ? -10 : 10, 7);
      assertEquals(Phase.CLIMBING, command.phase());
      tilt(reversed ? 10 : -10, 7);
      assertEquals(Phase.DESCENDING, command.phase());
      tilt(0, 9);
      assertEquals(Phase.CLEARING, command.phase());
    }
    void reachRecovery() {
      reachClearance(false);
      tilt(0, 14);
      assertEquals(Phase.RECOVERING, command.phase());
    }
  }

  @Test public void flatGroundCrestLevelAndWheelSpeedsCannotCompleteTheCrossing() {
    var f = new Fixture(false, false);
    assertTrue(f.command.getRequirements().contains(f.drivetrain));
    f.command.initialize();
    f.tilt(0, 15);
    assertEquals(Phase.APPROACH, f.command.phase());
    assertTrue(f.request.vxMetersPerSecond > 0);
    f.tilt(-10, 7); // Descent before an observed climb proves nothing.
    assertEquals(Phase.APPROACH, f.command.phase());
    f.tilt(10, 7);
    assertEquals(Phase.CLIMBING, f.command.phase());
    f.tilt(0, 30); // Level across the crest must not finish or brake.
    assertEquals(Phase.CLIMBING, f.command.phase());
    assertEquals(0.6, f.request.vxMetersPerSecond, 1e-9);
    assertFalse(f.command.isFinished());
    assertTrue(f.failures.isEmpty());
  }

  @Test public void climbAndDescentNeedSustainedEvidenceAndRepeatedTimeCannotDebounce() {
    var f = new Fixture(false, false);
    f.command.initialize();
    f.tilt(10, 2);
    f.tilt(0, 1);
    f.tilt(10, 2);
    assertEquals(Phase.APPROACH, f.command.phase());
    for (int i = 0; i < 20; i++) f.command.execute();
    assertEquals(Phase.APPROACH, f.command.phase());
    f.tilt(10, 5);
    assertEquals(Phase.CLIMBING, f.command.phase());
    f.tilt(-10, 2);
    f.tilt(0, 1);
    f.tilt(-10, 2);
    assertEquals(Phase.CLIMBING, f.command.phase());
    f.tilt(-10, 5);
    assertEquals(Phase.DESCENDING, f.command.phase());
  }

  @Test public void rollAndRenewedTiltRestartTheFullLevelAndClearanceWindows() {
    var f = new Fixture(false, false);
    f.command.initialize();
    f.reachClearance(false);
    f.roll = 4;
    f.step();
    assertEquals(Phase.DESCENDING, f.command.phase());
    f.tilt(0, 10);
    assertEquals(Phase.DESCENDING, f.command.phase());
    f.roll = 0;
    f.tilt(0, 9);
    assertEquals(Phase.CLEARING, f.command.phase());
    f.tilt(0, 5);
    assertEquals(Phase.CLEARING, f.command.phase());
    f.tilt(-4, 1);
    assertEquals(Phase.DESCENDING, f.command.phase());
    assertTrue(f.request.vxMetersPerSecond > 0);
    f.tilt(0, 9);
    assertEquals(Phase.CLEARING, f.command.phase());
    f.tilt(0, 14);
    assertEquals(Phase.RECOVERING, f.command.phase());
  }

  @Test public void clearanceIsFollowedByLimitedBrakingAndMeasuredSettling() {
    var f = new Fixture(false, false);
    f.command.initialize();
    f.reachRecovery();
    assertTrue(f.request.vxMetersPerSecond > 0);
    double previous = f.request.vxMetersPerSecond;
    for (int i = 0; i < 60 && !f.command.isFinished(); i++) {
      f.step();
      if (!f.command.isFinished()) assertTrue(Math.abs(f.request.vxMetersPerSecond - previous) <= 0.02 + 1e-9);
      previous = f.request.vxMetersPerSecond;
    }
    assertTrue(f.command.wasSuccessful());
    assertEquals(List.of(Phase.APPROACH, Phase.CLIMBING, Phase.DESCENDING, Phase.CLEARING,
        Phase.RECOVERING, Phase.SUCCEEDED), f.phases);
    assertEquals(0, f.request.vxMetersPerSecond, 0);
    assertTrue(f.failures.isEmpty());
  }

  @Test public void aStoppedRequestAloneDoesNotMeanTheRobotHasSettled() {
    var f = new Fixture(false, false);
    f.command.initialize();
    f.reachRecovery();
    for (int i = 0; i < 50; i++) {
      f.measured = new ChassisSpeeds(0.2, 0, 0.2);
      f.step();
    }
    assertEquals(0, f.request.vxMetersPerSecond, 1e-9);
    assertFalse(f.command.isFinished());
    f.measured = new ChassisSpeeds();
    f.tilt(0, 9);
    assertTrue(f.command.wasSuccessful());
  }

  @Test public void recoveryRequiresAnActuallyNewFreshNonfuturePositionFrame() {
    var f = new Fixture(true, false);
    f.command.initialize();
    f.reachRecovery();
    f.visionTimestamp = f.now - 0.1; // Still fresh but captured before the clearance ended.
    f.tilt(0, 40);
    assertEquals(Phase.RECOVERING, f.command.phase());
    assertEquals(0, f.request.vxMetersPerSecond, 1e-9);
    f.visionTimestamp = f.now + 1;
    f.step();
    assertFalse(f.command.isFinished());
    f.freshVision = true;
    f.step();
    assertTrue(f.command.wasSuccessful());
  }

  @Test public void missingBumpAndMissingVisionTimeoutAsFailuresWithoutSuccess() {
    for (boolean bumpSeen : new boolean[] {false, true}) {
      var f = new Fixture(true, false);
      f.command.initialize();
      if (bumpSeen) f.reachRecovery();
      f.now += 6;
      f.command.execute();
      assertEquals(Phase.FAILED, f.command.phase());
      assertFalse(f.command.wasSuccessful());
      assertEquals(1, f.failures.size());
      assertTrue(f.command.failureReason().contains("timed out"));
      assertEquals(0, f.request.vxMetersPerSecond, 0);
      int reads = f.reads;
      f.command.execute();
      assertEquals(reads, f.reads);
      assertEquals(1, f.failures.size());
    }
  }

  @Test public void reversedCrossingReversesTravelAndTheTiltSequence() {
    var f = new Fixture(false, true);
    f.command.initialize();
    f.reachClearance(true);
    assertEquals(-Math.min(0.6, f.now - 10), f.request.vxMetersPerSecond, 1e-9);
    f.tilt(0, 60);
    assertTrue(f.command.wasSuccessful());
  }

  @Test public void gyroHeadingWrapsAndLimitingUsesTheFixedStartingFrame() {
    var f = new Fixture(false, false);
    f.yaw = Math.toRadians(179);
    f.command.initialize();
    f.tilt(0, 10);
    var previous = f.request;
    f.yaw = Math.toRadians(-179);
    f.step();
    assertTrue(f.request.omegaRadiansPerSecond < 0);
    assertTrue(f.request.vyMetersPerSecond < 0);
    assertTrue(Math.abs(f.request.omegaRadiansPerSecond - previous.omegaRadiansPerSecond) <= 0.04 + 1e-9);
    var startFrame = ChassisSpeeds.fromRobotRelativeSpeeds(f.request, Rotation2d.fromDegrees(2));
    assertEquals(previous.vxMetersPerSecond + 0.02, startFrame.vxMetersPerSecond, 1e-9);
    assertEquals(0, startFrame.vyMetersPerSecond, 1e-9);
  }

  @Test public void invalidStaleAndDisconnectedFeedbackStopImmediately() {
    for (int bad = 0; bad < 7; bad++) {
      var f = new Fixture(false, false);
      f.command.initialize();
      f.tilt(0, 10);
      assertTrue(f.request.vxMetersPerSecond > 0);
      switch (bad) {
        case 0 -> f.healthy = false;
        case 1 -> f.age = 2;
        case 2 -> f.yaw = Double.NaN;
        case 3 -> f.pitch = Double.NaN;
        case 4 -> f.roll = Double.NaN;
        case 5 -> f.measured = new ChassisSpeeds(Double.NaN, 0, 0);
        case 6 -> f.measured = null;
      }
      f.step();
      assertEquals(Phase.FAILED, f.command.phase());
      assertEquals(List.of("Bump feedback unavailable"), f.failures);
      assertEquals(0, f.request.vxMetersPerSecond, 0);
      assertEquals(0, f.request.omegaRadiansPerSecond, 0);
    }
  }

  @Test public void tiltedStartsAndBadControlTimeCannotDeclareSuccess() {
    var tilted = new Fixture(false, false);
    tilted.pitch = 5;
    tilted.command.initialize();
    assertEquals(Phase.FAILED, tilted.command.phase());
    assertTrue(tilted.command.failureReason().contains("level ground"));
    for (double time : new double[] {9, Double.NaN, Double.POSITIVE_INFINITY, -1}) {
      var f = new Fixture(false, false);
      f.command.initialize();
      f.now = time;
      f.command.execute();
      assertEquals(Phase.FAILED, f.command.phase());
      assertEquals(1, f.failures.size());
      assertEquals(0, f.request.vxMetersPerSecond, 0);
    }
  }

  @Test public void cancellationReportsFailureAndReinitializationResetsTheWholeSequence() {
    var f = new Fixture(false, false);
    f.command.initialize();
    f.reachClearance(false);
    f.command.end(true);
    assertEquals(Phase.INTERRUPTED, f.command.phase());
    assertFalse(f.command.wasSuccessful());
    assertEquals(List.of("Bump crossing interrupted"), f.failures);
    assertEquals(0, f.request.vxMetersPerSecond, 0);
    f.command.end(true);
    assertEquals(1, f.failures.size());
    f.pitch = 0;
    f.yaw = 1;
    f.command.initialize();
    assertEquals("", f.command.failureReason());
    f.step();
    assertEquals(Phase.APPROACH, f.command.phase());
    assertEquals(0, f.request.omegaRadiansPerSecond, 1e-9);
    assertEquals(0.02, f.request.vxMetersPerSecond, 1e-9);
  }

  @Test public void rejectsUnusableCrossingConfiguration() {
    var motion = new MotionConstraints(1, 1, 1, 1);
    assertThrows(NullPointerException.class, () -> new BumpCrossingConfig(null, .5, 8, 3, .06, .1, .2, 5, .1, .05, .1, true));
    assertThrows(IllegalArgumentException.class, () -> new BumpCrossingConfig(motion, 2, 8, 3, .06, .1, .2, 5, .1, .05, .1, true));
    assertThrows(IllegalArgumentException.class, () -> new BumpCrossingConfig(motion, .5, 3, 3, .06, .1, .2, 5, .1, .05, .1, true));
    double[] values = {.5, 8, 3, .06, .1, .2, 5, .1, .05, .1};
    for (int i = 0; i < values.length; i++) {
      for (double invalid : new double[] {-1, Double.NaN, Double.POSITIVE_INFINITY}) {
        var copy = values.clone();
        copy[i] = invalid;
        assertThrows(IllegalArgumentException.class, () -> new BumpCrossingConfig(motion,
            copy[0], copy[1], copy[2], copy[3], copy[4], copy[5], copy[6], copy[7], copy[8], copy[9], true));
      }
    }
  }
}
