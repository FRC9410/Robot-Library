package frc.powerlib.subsystems.io;

public class AbsolutePositionSubsystemIOSim implements AbsolutePositionSubsystemIO {
  private double positionRotations = 0.0;
  private double velocityRotationsPerSecond = 0.0;
  private double appliedVolts = 0.0;
  private double setpointRotations = 0.0;

  @Override
  public void updateInputs(Inputs inputs) {
    inputs.connected = true;
    inputs.positionRotations = positionRotations;
    inputs.velocityRotationsPerSecond = velocityRotationsPerSecond;
    inputs.appliedVolts = appliedVolts;
    inputs.setpointRotations = setpointRotations;
  }

  @Override
  public void setPositionRotations(double rotations) {
    setpointRotations = rotations;
    positionRotations = rotations;
    velocityRotationsPerSecond = 0.0;
  }

  @Override
  public void setVoltage(double volts) {
    appliedVolts = volts;
    velocityRotationsPerSecond = volts;
  }

  @Override
  public void stop() {
    appliedVolts = 0.0;
    velocityRotationsPerSecond = 0.0;
  }
}
