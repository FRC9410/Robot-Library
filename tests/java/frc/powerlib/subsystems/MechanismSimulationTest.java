package frc.powerlib.subsystems;

import static org.junit.Assert.*;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import com.ctre.phoenix6.signals.NeutralModeValue;
import frc.powerlib.configs.*;
import frc.powerlib.subsystems.io.*;
import java.util.List;
import java.util.Optional;
import org.junit.BeforeClass;
import org.junit.Test;

public class MechanismSimulationTest {
  @BeforeClass public static void initialize() { assertTrue(HAL.initialize(500, 0)); }
  private final LeadMotorConfig lead = new LeadMotorConfig(0, 0, 0, 0, Optional.empty(), Optional.empty(), Optional.empty(), 1, 1);
  private final MotionMagicConfig motion = new MotionMagicConfig(2, 10);
  private final List<MotorConfig> motors = List.of(MotorConfig.leader(20, NeutralModeValue.Brake, true));

  @Test public void velocityChangesOverTimeAndVoltageUsesMotorUnits() {
    var io = new VelocitySubsystemIOSim(); var inputs = new VelocitySubsystemIO.Inputs();
    io.setVelocity(10); io.updateInputs(inputs);
    assertTrue(inputs.velocityRotationsPerSecond > 0 && inputs.velocityRotationsPerSecond < 10);
    for (int i = 0; i < 100; i++) io.updateInputs(inputs);
    assertEquals(10, inputs.velocityRotationsPerSecond, 0.01); assertTrue(inputs.positionRotations > 0);
    io.setVoltage(6); for (int i = 0; i < 100; i++) io.updateInputs(inputs);
    assertTrue(inputs.velocityRotationsPerSecond > 20); // 6 V is not interpreted as 6 rotations/s.
    io.brake(); for (int i = 0; i < 100; i++) io.updateInputs(inputs);
    assertEquals(0, inputs.velocityRotationsPerSecond, 0.01);
  }
  @Test public void relativeMovesOverTimeAndRespectsSoftLimitsInVoltageMode() {
    var config = new RelativePositionSubsystemConfig(motors, lead, motion, motion, "SimWrist", "rotations", 0, 1, -1, 0, 0.01, 0);
    var io = new RelativePositionSubsystemIOSim(config); var inputs = new RelativePositionSubsystemIO.Inputs();
    io.setPosition(0.5); io.updateInputs(inputs); assertTrue(inputs.position > 0 && inputs.position < 0.5);
    for (int i = 0; i < 200; i++) io.updateInputs(inputs);
    assertEquals(0.5, inputs.position, 0.01);
    io.setVoltage(-12); for (int i = 0; i < 100; i++) io.updateInputs(inputs);
    assertEquals(-1, inputs.position, 0);
    io.zeroEncoder(0); io.stop(0); io.updateInputs(inputs); assertEquals(0, inputs.position, 0);
  }
  @Test public void absoluteInitialPositionAndMotionAreMeaningful() {
    var config = new AbsolutePositionSubsystemConfig(motors, lead, new CancoderConfig(21, 0, 0.5), motion, "SimHood", "rotations", Optional.of(0.25));
    var io = new AbsolutePositionSubsystemIOSim(config); var inputs = new AbsolutePositionSubsystemIO.Inputs();
    io.updateInputs(inputs); assertEquals(0.25, inputs.positionRotations, 0);
    io.setPositionRotations(0.75); io.updateInputs(inputs); assertTrue(inputs.positionRotations < 0.75);
    for (int i = 0; i < 200; i++) io.updateInputs(inputs);
    assertEquals(0.75, inputs.positionRotations, 0.01);
  }
  @Test public void injectedIoNeverCreatesHardwareDespiteMotorConfigs() {
    var velocity = new VelocitySubsystem(new VelocitySubsystemConfig(motors, lead, motion, "InjectedVelocity"), new VelocitySubsystemIO() {});
    var position = new AbsolutePositionSubsystem(new AbsolutePositionSubsystemConfig(motors, lead, new CancoderConfig(21, 0, 0.5), motion, "InjectedHood", "rotations", Optional.empty()), new AbsolutePositionSubsystemIO() {
      @Override public void updateInputs(Inputs inputs) { inputs.positionRotations = 0.4; }
    });
    try {
      assertNull(velocity.getVelocityMotor()); assertNull(position.getPositionMotor());
      position.periodic();
      assertEquals(0.4, position.getPositionRotations(), 0);
      assertEquals(144, position.getPositionDegrees(), 1e-9);
    }
    finally { CommandScheduler.getInstance().unregisterSubsystem(velocity, position); }
  }
}
