package frc.powerlib.subsystems.io;

public class AbsolutePositionSubsystemIOSim implements AbsolutePositionSubsystemIO {
  private double position = 0.0;
  private double setpoint = 0.0;
  private double appliedVolts = 0.0;

  @Override
  public void updateInputs(Inputs inputs) {
    position = setpoint;
    inputs.connected = true;
    inputs.position = position;
    inputs.setpoint = setpoint;
    inputs.appliedVolts = appliedVolts;
  }

  @Override
  public void setPosition(double position) {
    setpoint = position;
  }

  @Override
  public void setVoltage(double volts) {
    appliedVolts = volts;
  }

  @Override
  public void zeroEncoder(double position) {
    this.position = position;
    this.setpoint = position;
  }

  @Override
  public void stop(double stopVoltage) {
    appliedVolts = stopVoltage;
  }
}
