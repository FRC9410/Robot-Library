package frc.powerlib.subsystems.io;

import com.ctre.phoenix6.hardware.TalonFX;
import frc.powerlib.subsystems.VelocitySubsystem;

public class VelocitySubsystemIOReal implements VelocitySubsystemIO {
  private final VelocitySubsystem subsystem;

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
}
