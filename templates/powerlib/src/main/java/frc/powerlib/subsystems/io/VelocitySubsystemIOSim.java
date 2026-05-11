package frc.powerlib.subsystems.io;

public class VelocitySubsystemIOSim implements VelocitySubsystemIO {
  private double positionRotations = 0.0;
  private double velocityRotationsPerSecond = 0.0;
  private double appliedVolts = 0.0;

  @Override
  public void updateInputs(Inputs inputs) {
    inputs.connected = true;
    inputs.positionRotations = positionRotations;
    inputs.velocityRotationsPerSecond = velocityRotationsPerSecond;
    inputs.appliedVolts = appliedVolts;
  }
}
