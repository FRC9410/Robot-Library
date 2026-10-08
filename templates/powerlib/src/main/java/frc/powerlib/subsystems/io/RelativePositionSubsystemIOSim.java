package frc.powerlib.subsystems.io;

import frc.powerlib.configs.RelativePositionSubsystemConfig;

public class RelativePositionSubsystemIOSim implements RelativePositionSubsystemIO {
  private final MechanismSimulation model;
  private final RelativePositionSubsystemConfig config;
  private double setpoint;
  public RelativePositionSubsystemIOSim() { config = null; model = new MechanismSimulation(1, 2, 10); }
  public RelativePositionSubsystemIOSim(RelativePositionSubsystemConfig config) {
    this.config = config;
    model = new MechanismSimulation(config.leadConfig().sensorToMechanismRatio() * config.leadConfig().rotorToSensorRatio(),
        config.motionMagicConfig().cruiseVelocity(), config.motionMagicConfig().acceleration());
    zeroEncoder(config.homePosition());
  }
  @Override public void updateInputs(Inputs inputs) {
    model.update();
    if (config != null) model.limits(config.reverseSoftLimit(), config.forwardSoftLimit());
    inputs.position = model.position; inputs.setpoint = setpoint;
  }
  @Override public void setPosition(double position) {
    if (config != null) {
      var profile = position <= model.position ? config.slowMotionMagicConfig() : config.motionMagicConfig();
      model.profile(profile.cruiseVelocity(), profile.acceleration());
      position = Math.max(config.reverseSoftLimit(), Math.min(config.forwardSoftLimit(), position));
    }
    setpoint = position; model.position(position);
  }
  @Override public void setVoltage(double volts) { model.voltage(volts); }
  @Override public void zeroEncoder(double position) { setpoint = position; model.reset(position); }
  @Override public void stop(double stopVoltage) { model.voltage(stopVoltage); }
}
