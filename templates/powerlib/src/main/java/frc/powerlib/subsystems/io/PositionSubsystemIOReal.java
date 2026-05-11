package frc.powerlib.subsystems.io;

import com.ctre.phoenix6.controls.MotionMagicVoltage;
import com.ctre.phoenix6.hardware.TalonFX;
import frc.powerlib.subsystems.PositionSubsystem;

public class PositionSubsystemIOReal implements PositionSubsystemIO {
  private final PositionSubsystem subsystem;

  public PositionSubsystemIOReal(PositionSubsystem subsystem) {
    this.subsystem = subsystem;
  }

  @Override
  public void updateInputs(Inputs inputs) {
    TalonFX motor = subsystem.getPositionMotor();
    inputs.connected = motor != null;
    if (motor == null) {
      return;
    }

    inputs.positionRotations = motor.getPosition().getValueAsDouble();
    inputs.velocityRotationsPerSecond = motor.getVelocity().getValueAsDouble();
    inputs.appliedVolts = motor.getMotorVoltage().getValueAsDouble();
    inputs.setpointRotations = subsystem.getSetpointRotations();
  }

  @Override
  public void setPositionRotations(double rotations) {
    TalonFX motor = subsystem.getPositionMotor();
    if (motor != null) {
      motor.setControl(
          new MotionMagicVoltage(0)
              .withPosition(rotations)
              .withSlot(0)
              .withEnableFOC(subsystem.isFocEnabled()));
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
  public void stop() {
    TalonFX motor = subsystem.getPositionMotor();
    if (motor != null) {
      motor.set(0);
    }
  }
}
