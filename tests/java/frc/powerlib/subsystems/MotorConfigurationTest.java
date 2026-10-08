package frc.powerlib.subsystems;

import static org.junit.Assert.*;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.signals.FeedbackSensorSourceValue;
import com.ctre.phoenix6.signals.InvertedValue;
import com.ctre.phoenix6.signals.NeutralModeValue;
import frc.powerlib.configs.*;
import java.util.List;
import java.util.Optional;
import org.junit.Test;

public class MotorConfigurationTest {
  private final MotorConfig motor = MotorConfig.leader(10, NeutralModeValue.Brake, true);
  private final LeadMotorConfig lead = new LeadMotorConfig(1, 2, 3, 4,
      Optional.of(0.2), Optional.empty(), Optional.of(0.4), 5, 6);
  private final MotionMagicConfig motion = new MotionMagicConfig(7, 8);

  private void assertOutput(TalonFXConfiguration config) {
    assertEquals(NeutralModeValue.Brake, config.MotorOutput.NeutralMode);
    assertEquals(InvertedValue.Clockwise_Positive, config.MotorOutput.Inverted);
  }

  @Test public void velocityPreservesOutputAndIndependentFeedforward() {
    var config = MotorConfiguration.closedLoop(motor, lead, motion);
    assertOutput(config);
    assertEquals(1, config.Slot0.kP, 0);
    assertEquals(2, config.Slot0.kI, 0);
    assertEquals(3, config.Slot0.kD, 0);
    assertEquals(4, config.Slot0.kG, 0);
    assertEquals(0.2, config.Slot0.kS, 0);
    assertEquals(0, config.Slot0.kV, 0);
    assertEquals(0.4, config.Slot0.kA, 0);
    assertEquals(5, config.Feedback.SensorToMechanismRatio, 0);
    assertEquals(7, config.MotionMagic.MotionMagicCruiseVelocity, 0);
  }

  @Test public void absolutePreservesOutputAndFusedEncoder() {
    var mechanism = new AbsolutePositionSubsystemConfig(List.of(motor), lead,
        new CancoderConfig(11, 0.1, 0.5), motion, "Hood", "rotations", Optional.empty());
    var config = MotorConfiguration.absolute(motor, mechanism);
    assertOutput(config);
    assertEquals(11, config.Feedback.FeedbackRemoteSensorID);
    assertEquals(FeedbackSensorSourceValue.FusedCANcoder, config.Feedback.FeedbackSensorSource);
  }

  @Test public void relativePreservesOutputAndSoftLimits() {
    var mechanism = new RelativePositionSubsystemConfig(List.of(motor), lead, motion, motion,
        "Wrist", "rotations", 0, 2, -1, 0.1, 0.01, 0);
    var config = MotorConfiguration.relative(motor, mechanism);
    assertOutput(config);
    assertTrue(config.SoftwareLimitSwitch.ForwardSoftLimitEnable);
    assertEquals(2, config.SoftwareLimitSwitch.ForwardSoftLimitThreshold, 0);
    assertEquals(-1, config.SoftwareLimitSwitch.ReverseSoftLimitThreshold, 0);
  }

  @Test public void followerOutputRetainsCoastAndDoesNotBorrowLeaderGains() {
    var config = MotorConfiguration.output(MotorConfig.follower(12, NeutralModeValue.Coast, false));
    assertEquals(NeutralModeValue.Coast, config.MotorOutput.NeutralMode);
    assertEquals(InvertedValue.CounterClockwise_Positive, config.MotorOutput.Inverted);
    assertEquals(0, config.Slot0.kP, 0);
    assertEquals(InvertedValue.CounterClockwise_Positive,
        MotorConfiguration.output(MotorConfig.follower(13, true)).MotorOutput.Inverted);
  }
}
