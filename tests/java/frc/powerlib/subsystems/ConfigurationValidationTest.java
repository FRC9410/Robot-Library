package frc.powerlib.subsystems;

import static org.junit.Assert.*;
import com.ctre.phoenix6.StatusCode;
import com.ctre.phoenix6.signals.NeutralModeValue;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import frc.powerlib.PowerRobotContainer;
import frc.powerlib.configs.*;
import frc.powerlib.subsystems.io.RelativePositionSubsystemIO;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.BeforeClass;
import org.junit.Test;

public class ConfigurationValidationTest {
  @BeforeClass public static void initialize() { assertTrue(HAL.initialize(500, 0)); }
  private LeadMotorConfig lead(double ratio) {
    return new LeadMotorConfig(0, 0, 0, 0, Optional.empty(), Optional.empty(), Optional.empty(), ratio, 1);
  }
  private RelativePositionSubsystemConfig relative(double home, double forward, double reverse, double tolerance) {
    return new RelativePositionSubsystemConfig(List.of(), lead(1), new MotionMagicConfig(1, 1),
        new MotionMagicConfig(0.5, 0.5), "ValidatedWrist", "rotations", home, forward, reverse, 0.1, tolerance, 0);
  }

  @Test public void rejectsInvalidRatiosAndNonfiniteGains() {
    for (double ratio : new double[] {0, -1001, 1001, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class, () -> lead(ratio));
    }
    assertEquals(-1, lead(-1).sensorToMechanismRatio(), 0);
    assertEquals(-44.444, new LeadMotorConfig(0, 0, 0, 0,
        Optional.empty(), Optional.empty(), Optional.empty(), -1, -44.444).rotorToSensorRatio(), 0);
    assertThrows(IllegalArgumentException.class, () -> new LeadMotorConfig(Double.NaN, 0, 0, 0,
        Optional.empty(), Optional.empty(), Optional.empty(), 1, 1));
    assertThrows(IllegalArgumentException.class, () -> new LeadMotorConfig(0, 0, 0, 0,
        Optional.of(Double.POSITIVE_INFINITY), Optional.empty(), Optional.empty(), 1, 1));
  }

  @Test public void preservesZeroVelocityCruiseAndRejectsInvalidProfiles() {
    assertEquals(0, MotionMagicConfig.forVelocity(5).cruiseVelocity(), 0);
    assertEquals(0, new MotionMagicConfig(0, 0).acceleration(), 0);
    assertThrows(IllegalArgumentException.class, () -> new MotionMagicConfig(-1, 2));
    assertThrows(IllegalArgumentException.class, () -> new MotionMagicConfig(1, Double.NaN));
    assertThrows(IllegalArgumentException.class, () -> new MotionMagicConfig(1, -1));
  }

  @Test public void requiresOrderedLimitsHomeWithinLimitsAndPositiveTolerance() {
    relative(0, 1, -1, 0.01);
    assertThrows(IllegalArgumentException.class, () -> relative(0, -1, 1, 0.01));
    assertThrows(IllegalArgumentException.class, () -> relative(2, 1, -1, 0.01));
    assertThrows(IllegalArgumentException.class, () -> relative(0, 1, -1, 0));
    assertThrows(IllegalArgumentException.class, () -> relative(0, Double.NaN, -1, 0.01));
  }

  @Test public void copiesMotorListsAndRejectsDuplicateIdsAndFollowerOnlyLists() {
    var motors = new ArrayList<MotorConfig>();
    motors.add(MotorConfig.leader(1, NeutralModeValue.Brake));
    var config = new VelocitySubsystemConfig(motors, lead(1), MotionMagicConfig.forVelocity(1), "ValidatedRoller");
    motors.clear();
    assertEquals(1, config.motorConfigs().size());
    assertThrows(UnsupportedOperationException.class, () -> config.motorConfigs().clear());
    assertThrows(IllegalArgumentException.class, () -> new VelocitySubsystemConfig(
        List.of(MotorConfig.follower(2)), lead(1), MotionMagicConfig.forVelocity(1), "FollowerOnly"));
    assertThrows(IllegalArgumentException.class, () -> new VelocitySubsystemConfig(
        List.of(config.motorConfigs().get(0), MotorConfig.follower(1)), lead(1), MotionMagicConfig.forVelocity(1), "Duplicates"));
    assertTrue(relative(0, 1, -1, 0.01).motorConfigs().isEmpty());
  }

  @Test public void rejectsUnsupportedDeviceSettings() {
    assertThrows(IllegalArgumentException.class, () -> MotorConfig.leader(63, NeutralModeValue.Brake));
    assertThrows(NullPointerException.class, () -> MotorConfig.leader(1, null));
    assertThrows(IllegalArgumentException.class, () -> new CancoderConfig(1, 1.1, 0.5));
    assertThrows(IllegalArgumentException.class, () -> new CancoderConfig(1, 0, -0.1));
    new CancoderConfig(0, -1, 0);
    new CancoderConfig(62, 1, 1);
  }

  private static class TuningProbe extends PowerSubsystem {
    int warnings;
    TuningProbe() { super(List.of(), "ValidationProbe", MotorConfiguration::output, false); }
    double readRatio(double fallback) { return getFeedbackRatioSubsystemVariable("Ratio", fallback); }
    double readGain(double fallback) { return getSubsystemVariable("Gain", fallback); }
    protected void reportRejectedTuning(String message) { warnings++; }
    void result(StatusCode status) { recordStartupConfiguration(status, "test device"); }
  }

  @Test public void rejectsLiveValuesKeepsFallbackAndReportsEachDistinctRejectionOnce() {
    var probe = new TuningProbe();
    try {
      PowerRobotContainer.updateSubsystemVariable("ValidationProbe", "Ratio", 0.0);
      assertEquals(3, probe.readRatio(3), 0);
      probe.readRatio(3);
      assertEquals(1, probe.warnings);
      PowerRobotContainer.updateSubsystemVariable("ValidationProbe", "Ratio", 4.0);
      assertEquals(4, probe.readRatio(3), 0);
      PowerRobotContainer.updateSubsystemVariable("ValidationProbe", "Ratio", 0.0);
      assertEquals(4, probe.readRatio(4), 0);
      assertEquals(2, probe.warnings);
      PowerRobotContainer.updateSubsystemVariable("ValidationProbe", "Ratio", -1.0);
      assertEquals(-1, probe.readRatio(4), 0);
      PowerRobotContainer.updateSubsystemVariable("ValidationProbe", "Gain", Double.NaN);
      assertEquals(2, probe.readGain(2), 0);
      PowerRobotContainer.updateSubsystemVariable("ValidationProbe", "Gain", "invalid");
      assertEquals(2, probe.readGain(2), 0);
      assertEquals(4, probe.warnings);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(probe); }
  }

  @Test public void failedStartupIsStickyAndBlocksPositionCommandsAndReadiness() {
    class RecordingIO implements RelativePositionSubsystemIO {
      int positions;
      public void setPosition(double target) { positions++; }
    }
    class FailingWrist extends RelativePositionSubsystem {
      FailingWrist(RecordingIO io) { super(relative(0, 1, -1, 0.01), io); }
      void fail() { recordStartupConfiguration(StatusCode.GeneralError, "test motor"); }
      void succeed() { recordStartupConfiguration(StatusCode.OK, "test motor"); }
    }
    var io = new RecordingIO();
    var wrist = new FailingWrist(io);
    try {
      assertTrue(wrist.isConfigured());
      assertTrue(frc.powerlib.health.HealthChecks.mechanismHealthy(wrist, wrist.getPositionMotor(), 0.5));
      int before = io.positions;
      wrist.fail(); wrist.succeed(); wrist.setPosition(0.5);
      assertFalse(wrist.isConfigured());
      assertFalse(frc.powerlib.health.HealthChecks.mechanismHealthy(wrist, wrist.getPositionMotor(), 0.5));
      assertFalse(wrist.isReady());
      assertFalse(wrist.atTargetPosition());
      assertEquals(before, io.positions);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(wrist); }
  }
}
