package frc.powerlib.subsystems;

import static org.junit.Assert.*;
import com.ctre.phoenix6.StatusCode;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import frc.powerlib.configs.*;
import frc.powerlib.subsystems.io.RelativePositionSubsystemIO;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.BeforeClass;
import org.junit.Test;

public class MotionProfileSequencingTest {
  @BeforeClass public static void initialize() { assertTrue(HAL.initialize(500, 0)); }

  private static class RecordingIO implements RelativePositionSubsystemIO {
    final List<Double> targets = new ArrayList<>();
    double position;
    String mode;
    public void updateInputs(Inputs inputs) { inputs.position = position; }
    public void setPosition(double target) { targets.add(target); mode = "position"; }
    public void setVoltage(double voltage) { mode = "voltage"; }
    public void zeroEncoder(double value) { position = value; }
  }

  private static RelativePositionSubsystemConfig config() {
    var lead = new LeadMotorConfig(0, 0, 0, 0, Optional.empty(), Optional.empty(), Optional.empty(), 1, 1);
    return new RelativePositionSubsystemConfig(List.of(), lead, new MotionMagicConfig(2, 3),
        new MotionMagicConfig(0.5, 1), "SequencedWrist", "rotations", 0, 3, -1, 0.1, 0.01, 0);
  }

  private static class DelayedWrist extends RelativePositionSubsystem {
    boolean acknowledged;
    double requestedCruise;
    int profileAttempts;
    DelayedWrist(RecordingIO io) { super(config(), io); }
    protected boolean configureMotionProfile(double cruise, double acceleration) {
      requestedCruise = cruise;
      profileAttempts++;
      return acknowledged;
    }
  }

  private DelayedWrist initialized(RecordingIO io) {
    var wrist = new DelayedWrist(io);
    wrist.acknowledged = true;
    wrist.periodic();
    io.targets.clear();
    return wrist;
  }

  @Test public void waitsForSuccessHoldsOnceThenActivatesOnce() {
    var io = new RecordingIO(); var wrist = initialized(io);
    try {
      io.position = 0.25; wrist.periodic();
      wrist.acknowledged = false; wrist.setPosition(2);
      assertEquals(2, wrist.getSetpoint(), 0);
      assertEquals(0.25, wrist.getActivatedSetpoint(), 0);
      assertEquals(List.of(0.25), io.targets);
      assertFalse(wrist.atTargetPosition());
      int attempts = wrist.profileAttempts;
      wrist.periodic(); wrist.periodic();
      assertTrue(wrist.profileAttempts > attempts);
      assertEquals(List.of(0.25), io.targets);
      wrist.acknowledged = true; wrist.periodic(); wrist.periodic();
      assertEquals(List.of(0.25, 2.0), io.targets);
      assertEquals(2, wrist.getActivatedSetpoint(), 0);
      io.position = 2; wrist.periodic();
      assertTrue(wrist.atTargetPosition());
    } finally { CommandScheduler.getInstance().unregisterSubsystem(wrist); }
  }

  @Test public void pendingTargetCanBeSupersededWithoutActivatingTheOldTarget() {
    var io = new RecordingIO(); var wrist = initialized(io);
    try {
      wrist.acknowledged = false;
      wrist.setPosition(1); wrist.setPosition(2);
      wrist.acknowledged = true; wrist.periodic();
      assertEquals(List.of(0.0, 2.0), io.targets);
      assertFalse(io.targets.contains(1.0));
    } finally { CommandScheduler.getInstance().unregisterSubsystem(wrist); }
  }

  @Test public void returningToTheOldProfileStillWaitsForOutstandingConfiguration() {
    var io = new RecordingIO(); var wrist = initialized(io);
    try {
      wrist.acknowledged = false;
      wrist.setPosition(2); assertEquals(2, wrist.requestedCruise, 0);
      wrist.setPosition(-0.5); assertEquals(0.5, wrist.requestedCruise, 0);
      wrist.periodic(); assertEquals(List.of(0.0), io.targets);
      wrist.acknowledged = true; wrist.periodic();
      assertEquals(List.of(0.0, -0.5), io.targets);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(wrist); }
  }

  @Test public void stopVoltageOutputAndEncoderResetCancelPendingTargets() {
    for (int cancellation = 0; cancellation < 5; cancellation++) {
      var io = new RecordingIO(); var wrist = initialized(io);
      try {
        wrist.acknowledged = false; wrist.setPosition(2);
        switch (cancellation) {
          case 0 -> wrist.stop();
          case 1 -> wrist.stopAll();
          case 2 -> wrist.setVoltage(1);
          case 3 -> wrist.setOutput(1, 0);
          case 4 -> wrist.zeroEncoder(0.5);
        }
        io.targets.clear();
        wrist.acknowledged = true; wrist.periodic();
        assertTrue(io.targets.isEmpty());
        assertFalse(wrist.atTargetPosition());
        wrist.setPosition(2);
        assertEquals(List.of(2.0), io.targets);
        if (cancellation == 4) assertEquals(0.5, wrist.getCurrentPosition(), 0);
      } finally { CommandScheduler.getInstance().unregisterSubsystem(wrist); }
    }
  }

  @Test public void startupHomeIsNotReadyUntilItsProfileIsConfirmed() {
    var io = new RecordingIO(); var wrist = new DelayedWrist(io);
    try {
      assertFalse(wrist.isReady());
      wrist.acknowledged = true; wrist.periodic();
      assertTrue(wrist.isReady());
    } finally { CommandScheduler.getInstance().unregisterSubsystem(wrist); }
  }

  @Test public void configurationFailureHoldsThroughBackoffAndReleasesAfterRetry() {
    var jobs = new ArrayDeque<Runnable>();
    var clock = new AtomicLong();
    var failures = new ArrayList<String>();
    var queue = new ConfigurationQueue(jobs::add, clock::get, failures::add);
    class QueuedWrist extends RelativePositionSubsystem {
      ConfigurationQueue profileQueue;
      StatusCode nextResult = StatusCode.OK;
      QueuedWrist(RecordingIO io) { super(config(), io); profileQueue = queue; }
      protected boolean configureMotionProfile(double cruise, double acceleration) {
        return profileQueue != null && profileQueue.request("profile", cruise + "/" + acceleration,
            () -> nextResult);
      }
    }
    var io = new RecordingIO(); var wrist = new QueuedWrist(io);
    try {
      wrist.periodic(); jobs.remove().run(); wrist.periodic();
      io.targets.clear();
      wrist.nextResult = StatusCode.GeneralError; wrist.setPosition(2);
      jobs.remove().run(); wrist.periodic();
      assertEquals(1, failures.size());
      assertTrue(jobs.isEmpty());
      assertEquals(List.of(0.0), io.targets);
      assertFalse(wrist.atTargetPosition());
      clock.set(500_000_000L);
      wrist.nextResult = StatusCode.OK; wrist.periodic();
      assertEquals(1, jobs.size());
      assertEquals(List.of(0.0), io.targets);
      jobs.remove().run(); wrist.periodic();
      assertEquals(List.of(0.0, 2.0), io.targets);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(wrist); }
  }
}
