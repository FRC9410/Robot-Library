package frc.powerlib.subsystems;

import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.configs.Slot0Configs;
import com.ctre.phoenix6.signals.FeedbackSensorSourceValue;
import com.ctre.phoenix6.signals.InvertedValue;
import frc.powerlib.configs.AbsolutePositionSubsystemConfig;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.configs.RelativePositionSubsystemConfig;

/** Builds motor configurations without reading or modifying hardware. */
final class MotorConfiguration {
  private MotorConfiguration() {}

  static TalonFXConfiguration output(MotorConfig motor) {
    TalonFXConfiguration config = new TalonFXConfiguration();
    config.MotorOutput.NeutralMode = motor.neutralMode();
    // Followers express reversal through Follower alignment, not motor inversion.
    config.MotorOutput.Inverted = !motor.isFollower() && motor.isReversed()
        ? InvertedValue.Clockwise_Positive : InvertedValue.CounterClockwise_Positive;
    return config;
  }

  static TalonFXConfiguration closedLoop(MotorConfig motor, LeadMotorConfig lead,
      MotionMagicConfig motion) {
    TalonFXConfiguration config = output(motor);
    config.Slot0 = slot0(lead.kP(), lead.kI(), lead.kD(), lead.kG(),
        lead.kS().orElse(0.0), lead.kV().orElse(0.0), lead.kA().orElse(0.0));
    config.Feedback.SensorToMechanismRatio = lead.sensorToMechanismRatio();
    config.Feedback.RotorToSensorRatio = lead.rotorToSensorRatio();
    config.MotionMagic.MotionMagicCruiseVelocity = motion.cruiseVelocity();
    config.MotionMagic.MotionMagicAcceleration = motion.acceleration();
    return config;
  }

  /** Same gain mapping for startup and live tuning in every closed-loop mechanism. */
  static Slot0Configs slot0(double kP, double kI, double kD, double kG,
      double kS, double kV, double kA) {
    return new Slot0Configs().withKP(kP).withKI(kI).withKD(kD).withKG(kG)
        .withKS(kS).withKV(kV).withKA(kA);
  }

  static TalonFXConfiguration absolute(MotorConfig motor, AbsolutePositionSubsystemConfig mechanism) {
    TalonFXConfiguration config = closedLoop(motor, mechanism.leadConfig(), mechanism.motionMagicConfig());
    config.Feedback.FeedbackRemoteSensorID = mechanism.cancoderConfig().encoderId();
    config.Feedback.FeedbackSensorSource = FeedbackSensorSourceValue.FusedCANcoder;
    return config;
  }

  static TalonFXConfiguration relative(MotorConfig motor, RelativePositionSubsystemConfig mechanism) {
    TalonFXConfiguration config = closedLoop(motor, mechanism.leadConfig(), mechanism.motionMagicConfig());
    config.SoftwareLimitSwitch.ForwardSoftLimitEnable = true;
    config.SoftwareLimitSwitch.ForwardSoftLimitThreshold = mechanism.forwardSoftLimit();
    config.SoftwareLimitSwitch.ReverseSoftLimitEnable = true;
    config.SoftwareLimitSwitch.ReverseSoftLimitThreshold = mechanism.reverseSoftLimit();
    return config;
  }
}
