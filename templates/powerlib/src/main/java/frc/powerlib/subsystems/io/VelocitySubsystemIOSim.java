package frc.powerlib.subsystems.io;

import frc.powerlib.configs.VelocitySubsystemConfig;

public class VelocitySubsystemIOSim implements VelocitySubsystemIO {
  private final MechanismSimulation model;
  private double setpoint;
  public VelocitySubsystemIOSim() { model = new MechanismSimulation(1, 100, 100); }
  public VelocitySubsystemIOSim(VelocitySubsystemConfig config) {
    model = new MechanismSimulation(config.leadConfig().sensorToMechanismRatio() * config.leadConfig().rotorToSensorRatio(),
        config.motionMagicConfig().cruiseVelocity(), config.motionMagicConfig().acceleration());
  }
  @Override public void updateInputs(Inputs inputs) {
    model.update();
    inputs.positionRotations = model.position;
    inputs.velocityRotationsPerSecond = model.velocity;
    inputs.velocitySetpoint = setpoint;
  }
  @Override public void setVelocity(double velocity) { setpoint = velocity; model.velocity(velocity); }
  @Override public void setVelocityWithoutFOC(double velocity) { setVelocity(velocity); }
  @Override public void setVoltage(double volts) { model.voltage(volts); }
  @Override public void brake() { setpoint = 0; model.voltage(0); }
}
