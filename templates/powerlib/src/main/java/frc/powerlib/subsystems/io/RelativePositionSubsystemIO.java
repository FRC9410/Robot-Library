package frc.powerlib.subsystems.io;

public interface RelativePositionSubsystemIO {
  public static class Inputs {
    public double position = 0.0;
    public double setpoint = 0.0;
  }

  default void updateInputs(Inputs inputs) {}

  default void setPosition(double position) {}

  default void setVoltage(double volts) {}

  default void zeroEncoder(double position) {}

  default void stop(double stopVoltage) {
    setVoltage(stopVoltage);
  }
}
