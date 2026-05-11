package frc.powerlib.subsystems.io;

public interface VelocitySubsystemIO {
  public static class Inputs {
    public boolean connected = false;
    public double positionRotations = 0.0;
    public double velocityRotationsPerSecond = 0.0;
    public double appliedVolts = 0.0;
  }

  default void updateInputs(Inputs inputs) {}

  default void setVelocity(double velocityRotationsPerSecond) {}

  default void setVelocityWithoutFOC(double velocityRotationsPerSecond) {
    setVelocity(velocityRotationsPerSecond);
  }

  default void setVoltage(double volts) {}

  default void stop() {
    setVelocity(0.0);
  }

  default void brake() {}
}
