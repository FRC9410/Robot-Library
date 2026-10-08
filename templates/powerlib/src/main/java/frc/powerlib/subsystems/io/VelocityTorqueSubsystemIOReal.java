package frc.powerlib.subsystems.io;

import com.ctre.phoenix6.controls.MotionMagicVelocityVoltage;
import com.ctre.phoenix6.controls.NeutralOut;
import com.ctre.phoenix6.controls.VelocityTorqueCurrentFOC;
import com.ctre.phoenix6.hardware.TalonFX;
import frc.powerlib.subsystems.VelocitySubsystem;

public class VelocityTorqueSubsystemIOReal implements VelocitySubsystemIO {
  private final VelocitySubsystem subsystem;
  private static final NeutralOut brake = new NeutralOut();
  private final VelocityTorqueCurrentFOC torqueRequest = new VelocityTorqueCurrentFOC(0);
  private final MotionMagicVelocityVoltage voltageRequest = new MotionMagicVelocityVoltage(0);

  public VelocityTorqueSubsystemIOReal(VelocitySubsystem subsystem) {
    this.subsystem = subsystem;
  }

  @Override
  public void updateInputs(Inputs inputs) {
    TalonFX motor = subsystem.getVelocityMotor();
    if (motor == null) {
      return;
    }

    inputs.positionRotations = motor.getPosition().getValueAsDouble();
    inputs.velocityRotationsPerSecond = motor.getVelocity().getValueAsDouble();
    inputs.velocitySetpoint = subsystem.getVelocitySetpoint();
  }

  @Override
  public void setVelocity(double velocityRotationsPerSecond) {
    TalonFX motor = subsystem.getVelocityMotor();
    if (motor != null) {
      if (!subsystem.isFocEnabled()) {
        setVelocityWithoutFOC(velocityRotationsPerSecond);
        return;
      }

      motor.setControl(
          torqueRequest.withVelocity(velocityRotationsPerSecond)
              .withFeedForward(subsystem.getTorqueFeedForward()));
    }
  }

  @Override
  public void setVelocityWithoutFOC(double velocityRotationsPerSecond) {
    TalonFX motor = subsystem.getVelocityMotor();
    if (motor != null) {
      motor.setControl(
          voltageRequest
              .withVelocity(velocityRotationsPerSecond)
              .withEnableFOC(false)
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
