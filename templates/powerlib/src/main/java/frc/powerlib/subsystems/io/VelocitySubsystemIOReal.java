package frc.powerlib.subsystems.io;

import com.ctre.phoenix6.controls.MotionMagicVelocityVoltage;
import com.ctre.phoenix6.controls.NeutralOut;
import com.ctre.phoenix6.hardware.TalonFX;
import frc.powerlib.subsystems.VelocitySubsystem;

public class VelocitySubsystemIOReal implements VelocitySubsystemIO {
  private final VelocitySubsystem subsystem;
  private static final NeutralOut brake = new NeutralOut();

  public VelocitySubsystemIOReal(VelocitySubsystem subsystem) {
    this.subsystem = subsystem;
  }

  @Override
  public void updateInputs(Inputs inputs) {
    TalonFX motor = subsystem.getVelocityMotor();
    inputs.connected = motor != null;
    if (motor == null) {
      return;
    }

    inputs.positionRotations = motor.getPosition().getValueAsDouble();
    inputs.velocityRotationsPerSecond = motor.getVelocity().getValueAsDouble();
    inputs.appliedVolts = motor.getMotorVoltage().getValueAsDouble();
  }

  @Override
  public void setVelocity(double velocityRotationsPerSecond) {
    TalonFX motor = subsystem.getVelocityMotor();
    if (motor != null) {
      motor.setControl(
          new MotionMagicVelocityVoltage(0)
              .withVelocity(velocityRotationsPerSecond)
              .withEnableFOC(subsystem.isFocEnabled())
              .withSlot(0));
    }
  }

  @Override
  public void setVelocityWithoutFOC(double velocityRotationsPerSecond) {
    TalonFX motor = subsystem.getVelocityMotor();
    if (motor != null) {
      motor.setControl(
          new MotionMagicVelocityVoltage(0)
              .withVelocity(velocityRotationsPerSecond)
              .withSlot(0));
    }
  }

  @Override
  public void setVoltage(double volts) {
    TalonFX motor = subsystem.getVelocityMotor();
    if (motor != null) {
      motor.setVoltage(volts);
    }
  }

  @Override
  public void brake() {
    TalonFX motor = subsystem.getVelocityMotor();
    if (motor != null) {
      motor.setControl(brake);
    }
  }
}
