package frc.powerlib.subsystems.io;

public class VelocitySubsystemIOSim implements VelocitySubsystemIO {
  private double positionRotations = 0.0;
  private double velocityRotationsPerSecond = 0.0;
  private double velocitySetpoint = 0.0;
  private double appliedVolts = 0.0;

  @Override
  public void updateInputs(Inputs inputs) {
    inputs.connected = true;
    inputs.positionRotations = positionRotations;
    inputs.velocityRotationsPerSecond = velocityRotationsPerSecond;
    inputs.velocitySetpoint = velocitySetpoint;
    inputs.appliedVolts = appliedVolts;
  }

  @Override
  public void setVelocity(double velocityRotationsPerSecond) {
    this.velocitySetpoint = velocityRotationsPerSecond;
    this.velocityRotationsPerSecond = velocityRotationsPerSecond;
  }

  @Override
  public void setVoltage(double volts) {
    this.appliedVolts = volts;
    this.velocitySetpoint = volts;
    this.velocityRotationsPerSecond = volts;
  }

  @Override
  public void stop() {
    velocityRotationsPerSecond = 0.0;
    velocitySetpoint = 0.0;
    appliedVolts = 0.0;
  }

  @Override
  public void brake() {
    stop();
  }
}
