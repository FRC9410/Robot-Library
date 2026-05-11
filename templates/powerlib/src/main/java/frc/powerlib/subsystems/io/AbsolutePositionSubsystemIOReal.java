package frc.powerlib.subsystems.io;

import com.ctre.phoenix6.controls.MotionMagicVoltage;
import com.ctre.phoenix6.hardware.TalonFX;
import frc.powerlib.subsystems.AbsolutePositionSubsystem;

public class AbsolutePositionSubsystemIOReal implements AbsolutePositionSubsystemIO {
  private final AbsolutePositionSubsystem subsystem;
  private final MotionMagicVoltage motionMagicRequest = new MotionMagicVoltage(0);
  private double setpoint = 0.0;

  public AbsolutePositionSubsystemIOReal(AbsolutePositionSubsystem subsystem) {
    this.subsystem = subsystem;
  }

  @Override
  public void updateInputs(Inputs inputs) {
    TalonFX motor = subsystem.getPositionMotor();
    inputs.connected = motor != null;
    inputs.setpoint = setpoint;
    if (motor == null) {
      return;
    }

    inputs.position = motor.getPosition().getValueAsDouble();
    inputs.appliedVolts = motor.getMotorVoltage().getValueAsDouble();
  }

  @Override
  public void setPosition(double position) {
    setpoint = position;
    TalonFX motor = subsystem.getPositionMotor();
    if (motor != null) {
      motor.setControl(motionMagicRequest.withPosition(position).withSlot(0));
    }
  }

  @Override
  public void setVoltage(double volts) {
    TalonFX motor = subsystem.getPositionMotor();
    if (motor != null) {
      motor.setVoltage(volts);
    }
  }

  @Override
  public void zeroEncoder(double position) {
    TalonFX motor = subsystem.getPositionMotor();
    if (motor != null) {
      motor.setPosition(position);
    }
  }
}
