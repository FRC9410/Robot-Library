package frc.powerlib.subsystems.io;

import frc.powerlib.configs.VelocitySubsystemConfig;

public class VelocitySubsystemIOSim implements VelocitySubsystemIO {
  private final MechanismSimulation model;
  private double setpoint;
  private double appliedVoltage;
  private double rotorRatio = 1;
  private edu.wpi.first.math.system.plant.DCMotor motor = edu.wpi.first.math.system.plant.DCMotor.getKrakenX60(1);
  public VelocitySubsystemIOSim() { model = new MechanismSimulation(1, 100, 100); }
  public VelocitySubsystemIOSim(VelocitySubsystemConfig config) {
    rotorRatio = config.leadConfig().sensorToMechanismRatio() * config.leadConfig().rotorToSensorRatio();
    motor = config.motorConfigs().stream().filter(item -> !item.isFollower()).findFirst()
        .map(item -> item.motorType() == frc.powerlib.configs.MotorConfig.MotorType.X44
            ? edu.wpi.first.math.system.plant.DCMotor.getKrakenX44(1) : edu.wpi.first.math.system.plant.DCMotor.getKrakenX60(1))
        .orElse(motor);
    model = new MechanismSimulation(config.leadConfig().sensorToMechanismRatio() * config.leadConfig().rotorToSensorRatio(),
        config.motionMagicConfig().cruiseVelocity(), config.motionMagicConfig().acceleration(), config.motorConfigs());
  }
  @Override public void updateInputs(Inputs inputs) {
    model.update();
    inputs.positionRotations = model.position;
    inputs.velocityRotationsPerSecond = model.velocity;
    inputs.velocitySetpoint = setpoint;
    inputs.appliedVoltage = appliedVoltage;
    inputs.torqueCurrentAmps = motor.getCurrent(model.velocity * rotorRatio * 2 * Math.PI, appliedVoltage);
  }
  @Override public void setVelocity(double velocity) { setpoint = velocity; appliedVoltage = 0; model.velocity(velocity); }
  @Override public void setVelocityWithoutFOC(double velocity) { setVelocity(velocity); }
  @Override public void setVoltage(double volts) { appliedVoltage = Math.max(-12, Math.min(12, volts)); model.voltage(appliedVoltage); }
  @Override public void brake() { setpoint = 0; appliedVoltage = 0; model.voltage(0); }
}
