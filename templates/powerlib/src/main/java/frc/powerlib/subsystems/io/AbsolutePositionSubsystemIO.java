package frc.powerlib.subsystems.io;

public interface AbsolutePositionSubsystemIO {
  public static class Inputs {
    public boolean connected = false;
    public double positionRotations = 0.0;
    public double velocityRotationsPerSecond = 0.0;
    public double appliedVolts = 0.0;
    public double setpointRotations = 0.0;
  }

  default void updateInputs(Inputs inputs) {}

  default void setPositionRotations(double rotations) {}

  default void setVoltage(double volts) {}

  default void stop() {}
}
