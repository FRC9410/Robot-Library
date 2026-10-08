package frc.powerlib.subsystems;

import static org.junit.Assert.*;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import frc.powerlib.configs.*;
import frc.powerlib.subsystems.io.RelativePositionSubsystemIO;
import java.util.List;
import java.util.Optional;
import org.junit.BeforeClass;
import org.junit.Test;

public class RelativeControlTest {
  @BeforeClass public static void initialize() { assertTrue(HAL.initialize(500, 0)); }
  private static class RecordingIO implements RelativePositionSubsystemIO {
    int positions, voltages;
    String mode;
    public void setPosition(double position) { positions++; mode = "position"; }
    public void setVoltage(double volts) { voltages++; mode = "voltage"; }
  }
  private RelativePositionSubsystem mechanism(RecordingIO io) {
    var lead = new LeadMotorConfig(0, 0, 0, 0, Optional.empty(), Optional.empty(), Optional.empty(), 1, 1);
    var motion = new MotionMagicConfig(1, 1);
    return new RelativePositionSubsystem(new RelativePositionSubsystemConfig(List.of(), lead,
        motion, motion, "TestWrist", "rotations", 0, 2, -1, 0.1, 0.01, 0), io);
  }
  @Test public void returningToTheSamePositionRestoresPositionControl() {
    var io = new RecordingIO(); var mechanism = mechanism(io);
    try {
      mechanism.setPosition(1); mechanism.setVoltage(2); mechanism.setPosition(1);
      assertEquals("position", io.mode); assertEquals(3, io.positions);
      mechanism.setPosition(1); assertEquals(3, io.positions);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(mechanism); }
  }
  @Test public void returningToTheSameVoltageRestoresVoltageControl() {
    var io = new RecordingIO(); var mechanism = mechanism(io);
    try {
      mechanism.setVoltage(2); mechanism.setPosition(1); mechanism.setVoltage(2);
      assertEquals("voltage", io.mode); assertEquals(2, io.voltages);
      mechanism.setVoltage(2); assertEquals(2, io.voltages);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(mechanism); }
  }
  @Test public void encoderResetInvalidatesPositionCache() {
    var io = new RecordingIO(); var mechanism = mechanism(io);
    try {
      mechanism.setPosition(1); mechanism.zeroEncoder(); mechanism.setPosition(1);
      assertEquals(3, io.positions);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(mechanism); }
  }
  @Test public void stoppingAllowsTheSamePositionToResume() {
    var io = new RecordingIO(); var mechanism = mechanism(io);
    try {
      mechanism.setPosition(1); mechanism.stop(); mechanism.setPosition(1);
      assertEquals("position", io.mode); assertEquals(3, io.positions);
    } finally { CommandScheduler.getInstance().unregisterSubsystem(mechanism); }
  }
}
