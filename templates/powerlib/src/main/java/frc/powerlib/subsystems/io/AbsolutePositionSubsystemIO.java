package frc.powerlib.subsystems.io;

public interface AbsolutePositionSubsystemIO {
  public static class Inputs {
    public boolean connected = false;
    public double position = 0.0;
    public double setpoint = 0.0;
    public double appliedVolts = 0.0;
  }

  default void updateInputs(Inputs inputs) {}

  default void setPosition(double position) {}

  default void setVoltage(double volts) {}

  default void zeroEncoder(double position) {}

  default void stop(double stopVoltage) {
    setVoltage(stopVoltage);
  }
}
