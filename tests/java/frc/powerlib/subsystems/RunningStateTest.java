package frc.powerlib.subsystems;

import static org.junit.Assert.*;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import frc.powerlib.configs.*;
import frc.powerlib.subsystems.io.VelocitySubsystemIO;
import java.util.List;
import java.util.Optional;
import org.junit.BeforeClass;
import org.junit.Test;

public class RunningStateTest {
  @BeforeClass public static void initialize() { assertTrue(HAL.initialize(500, 0)); }
  @Test public void mechanismUsesFiniteAbsoluteCachedSpeed() {
    var lead = new LeadMotorConfig(0, 0, 0, 0, Optional.empty(), Optional.empty(), Optional.empty(), 1, 1);
    var mechanism = new VelocitySubsystem(new VelocitySubsystemConfig(List.of(), lead,
        new MotionMagicConfig(1, 1), "RunningTest"), new VelocitySubsystemIO() {});
    try {
      for (double speed : new double[] {0, 0.1, -0.1, Double.NaN, Double.POSITIVE_INFINITY}) {
        mechanism.inputs.velocityRotationsPerSecond = speed;
        assertFalse(mechanism.isRunning());
      }
      for (double speed : new double[] {5, -5}) {
        mechanism.inputs.velocityRotationsPerSecond = speed;
        assertTrue(mechanism.isRunning());
      }
      assertFalse(mechanism.isMotorRunning(999));
      assertFalse(mechanism.isAllMotorsRunning());
    } finally { CommandScheduler.getInstance().unregisterSubsystem(mechanism); }
  }
}
