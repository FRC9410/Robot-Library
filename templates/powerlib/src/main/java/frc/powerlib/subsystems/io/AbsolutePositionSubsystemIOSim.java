package frc.powerlib.subsystems.io;

import frc.powerlib.configs.AbsolutePositionSubsystemConfig;

public class AbsolutePositionSubsystemIOSim implements AbsolutePositionSubsystemIO {
  private final MechanismSimulation model;
  private double setpoint;
  public AbsolutePositionSubsystemIOSim() { model = new MechanismSimulation(1, 2, 10); }
  public AbsolutePositionSubsystemIOSim(AbsolutePositionSubsystemConfig config) {
    model = new MechanismSimulation(config.leadConfig().sensorToMechanismRatio() * config.leadConfig().rotorToSensorRatio(),
        config.motionMagicConfig().cruiseVelocity(), config.motionMagicConfig().acceleration());
    setpoint = config.defaultPosition().orElse(0.0);
    model.reset(setpoint); model.position(setpoint);
  }
  @Override public void updateInputs(Inputs inputs) {
    model.update();
    inputs.positionRotations = model.position;
    inputs.velocityRotationsPerSecond = model.velocity;
    inputs.setpointRotations = setpoint;
  }
  @Override public void setPositionRotations(double rotations) { setpoint = rotations; model.position(rotations); }
  @Override public void setVoltage(double volts) { model.voltage(volts); }
  @Override public void stop() { model.voltage(0); }
}
