// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.subsystems;

import com.ctre.phoenix6.configs.FeedbackConfigs;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.Slot0Configs;
import com.ctre.phoenix6.hardware.TalonFX;

import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.configs.VelocitySubsystemConfig;
import frc.powerlib.subsystems.io.VelocitySubsystemIO;
import frc.powerlib.subsystems.io.VelocitySubsystemIOReal;
import frc.powerlib.subsystems.io.VelocitySubsystemIOSim;


public class VelocitySubsystem extends PowerSubsystem {

  /** Primary velocity-controlled motor; set in subclass after init. */
  protected TalonFX velocityMotor;
  public final VelocitySubsystemIO.Inputs inputs = new VelocitySubsystemIO.Inputs();
  private final VelocitySubsystemIO io;
  private final VelocitySubsystemConfig config;
  private boolean focEnabled;
  private double torqueFeedForward;
  private double velocitySetpoint;
  private double kP;
  private double kI;
  private double kD;
  private double kG;
  private double kS;
  private double kV;
  private double kA;
  private double sensorToMechanismRatio;
  private double rotorToSensorRatio;
  private double motionMagicCruiseVelocity;
  private double motionMagicAcceleration;
  /**
   * Constructor that uses the leader motor from the config and configures it with lead and motion
   * magic settings from the same config.
   *
   * @param config single config containing motor configs, lead, motion magic, and name
   */
  public VelocitySubsystem(VelocitySubsystemConfig config) {
    this(config, null);
  }

  public VelocitySubsystem(VelocitySubsystemConfig config, VelocitySubsystemIO io) {
    super(config.motorConfigs(), config.subsystemName(),
        motor -> MotorConfiguration.closedLoop(motor, config.leadConfig(), config.motionMagicConfig()),
        io == null && !RobotBase.isSimulation());
    TalonFX leader = getLeaderMotor();
    if (leader != null) {
      this.velocityMotor = leader;
    }
    this.config = config;
    this.focEnabled = config.leadConfig().focEnabled();
    this.torqueFeedForward = config.torqueFeedForward();
    this.velocitySetpoint = 0.0;
    initializeTunableState(config.leadConfig(), config.motionMagicConfig());
    this.io = io == null ? createDefaultIO() : io;
  }

  protected VelocitySubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? createSimulationIO() : new VelocitySubsystemIOReal(this);
  }

  protected VelocitySubsystemIO createSimulationIO() { return new VelocitySubsystemIOSim(config); }

  @Override
  public void periodic() {
    io.updateInputs(inputs);
    if (shouldSyncTuning()) {
      applyMotorTunableValues();
      applyTunableValues();
    }
    setSubsystemData("Velocity", inputs.velocityRotationsPerSecond, "rotations per second");
    setSubsystemData("VelocitySetpoint", inputs.velocitySetpoint, "rotations per second");
  }

  private void initializeTunableState(
      LeadMotorConfig leadConfig, MotionMagicConfig motionMagicConfig) {
    kP = leadConfig.kP();
    kI = leadConfig.kI();
    kD = leadConfig.kD();
    kG = leadConfig.kG();
    kS = leadConfig.kS().orElse(0.0);
    kV = leadConfig.kV().orElse(0.0);
    kA = leadConfig.kA().orElse(0.0);
    sensorToMechanismRatio = leadConfig.sensorToMechanismRatio();
    rotorToSensorRatio = leadConfig.rotorToSensorRatio();
    motionMagicCruiseVelocity = motionMagicConfig.cruiseVelocity();
    motionMagicAcceleration = motionMagicConfig.acceleration();

    registerSubsystemVariable("Control/FOCEnabled", focEnabled);
    registerSubsystemVariable("PID/kP", kP);
    registerSubsystemVariable("PID/kI", kI);
    registerSubsystemVariable("PID/kD", kD);
    registerSubsystemVariable("PID/kG", kG);
    registerSubsystemVariable("Feedforward/kS", kS);
    registerSubsystemVariable("Feedforward/kV", kV);
    registerSubsystemVariable("Feedforward/kA", kA);
    registerSubsystemVariable("Feedforward/Torque", torqueFeedForward);
    registerSubsystemVariable("Ratios/SensorToMechanism", sensorToMechanismRatio);
    registerSubsystemVariable("Ratios/RotorToSensor", rotorToSensorRatio);
    registerSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    registerSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
  }

  private void applyTunableValues() {
    if (!frc.powerlib.PowerRobotContainer.isTuningEnabled() || velocityMotor == null) {
      return;
    }

    double nextKP = getSubsystemVariable("PID/kP", kP);
    double nextKI = getSubsystemVariable("PID/kI", kI);
    double nextKD = getSubsystemVariable("PID/kD", kD);
    double nextKG = getSubsystemVariable("PID/kG", kG);
    double nextKS = getSubsystemVariable("Feedforward/kS", kS);
    double nextKV = getSubsystemVariable("Feedforward/kV", kV);
    double nextKA = getSubsystemVariable("Feedforward/kA", kA);
    double nextTorqueFeedForward = getSubsystemVariable("Feedforward/Torque", torqueFeedForward);

    if (changed(nextKP, kP)
        || changed(nextKI, kI)
        || changed(nextKD, kD)
        || changed(nextKG, kG)
        || changed(nextKS, kS)
        || changed(nextKV, kV)
        || changed(nextKA, kA) || pendingConfiguration(velocityMotor, Slot0Configs.class)) {
      Slot0Configs slot0 = MotorConfiguration.slot0(nextKP, nextKI, nextKD, nextKG, nextKS, nextKV, nextKA);
      if (applyRuntimeConfiguration(velocityMotor, slot0)) {
        kP = nextKP;
        kI = nextKI;
        kD = nextKD;
        kG = nextKG;
        kS = nextKS;
        kV = nextKV;
        kA = nextKA;
      }
    }

    if (changed(nextTorqueFeedForward, torqueFeedForward)) {
      torqueFeedForward = nextTorqueFeedForward;
    }

    boolean nextFocEnabled = getSubsystemVariable("Control/FOCEnabled", focEnabled);
    if (nextFocEnabled != focEnabled) {
      focEnabled = nextFocEnabled;
    }

    double nextSensorToMechanismRatio =
        getPositiveSubsystemVariable("Ratios/SensorToMechanism", sensorToMechanismRatio);
    double nextRotorToSensorRatio = getPositiveSubsystemVariable("Ratios/RotorToSensor", rotorToSensorRatio);
    if (changed(nextSensorToMechanismRatio, sensorToMechanismRatio)
        || changed(nextRotorToSensorRatio, rotorToSensorRatio) || pendingConfiguration(velocityMotor, FeedbackConfigs.class)) {
      if (applyFeedbackRatios(velocityMotor, nextSensorToMechanismRatio, nextRotorToSensorRatio)) {
        sensorToMechanismRatio = nextSensorToMechanismRatio;
        rotorToSensorRatio = nextRotorToSensorRatio;
      }
    }

    double nextCruiseVelocity =
        getNonnegativeSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    double nextAcceleration = getNonnegativeSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
    if (changed(nextCruiseVelocity, motionMagicCruiseVelocity)
        || changed(nextAcceleration, motionMagicAcceleration) || pendingConfiguration(velocityMotor, MotionMagicConfigs.class)) {
      MotionMagicConfigs motionMagicConfigs = new MotionMagicConfigs();
      motionMagicConfigs.withMotionMagicCruiseVelocity(nextCruiseVelocity);
      motionMagicConfigs.withMotionMagicAcceleration(nextAcceleration);
      if (applyRuntimeConfiguration(velocityMotor, motionMagicConfigs)) {
        motionMagicCruiseVelocity = nextCruiseVelocity;
        motionMagicAcceleration = nextAcceleration;
      }
    }
  }

  private boolean applyFeedbackRatios(
      TalonFX motor, double sensorToMechanismRatio, double rotorToSensorRatio) {
    FeedbackConfigs feedbackConfigs = new FeedbackConfigs();
    feedbackConfigs.SensorToMechanismRatio = sensorToMechanismRatio;
    feedbackConfigs.RotorToSensorRatio = rotorToSensorRatio;
    return applyRuntimeConfiguration(motor, feedbackConfigs);
  }

  /**
   * Sets velocity setpoint (e.g. rotations per second) using Motion Magic. Override or use
   * directly after {@link #velocityMotor} is set.
   */
  public void setVelocity(double velocityRotationsPerSecond) {
    if (!isConfigured()) return;
    velocitySetpoint = velocityRotationsPerSecond;
    io.setVelocity(velocityRotationsPerSecond);
  }

  public void setVelocityWithoutFOC(double velocityRotationsPerSecond) {
    if (!isConfigured()) return;
    velocitySetpoint = velocityRotationsPerSecond;
    io.setVelocityWithoutFOC(velocityRotationsPerSecond);
  }

  /** Stops the velocity motor. */
  public void stopVelocity() {
    velocitySetpoint = 0.0;
    io.stop();
  }

  /**
   * Applies the given voltage to the velocity motor (leader only; followers follow).
   * Use for SysId characterization. Voltage is in volts.
   */
  public void setVoltage(double volts) {
    if (!isConfigured()) return;
    io.setVoltage(volts);
  }

  /** Returns the primary velocity motor (if initialized). */
  public TalonFX getVelocityMotor() {
    return velocityMotor;
  }

  public boolean isFocEnabled() {
    return focEnabled;
  }

  public double getTorqueFeedForward() {
    return torqueFeedForward;
  }

  public double getVelocitySetpoint() {
    return velocitySetpoint;
  }

  public boolean isRunning () {
    return isConfigured() && isRunningVelocity(inputs.velocityRotationsPerSecond);
  }
  
  public void brake () {
    io.brake();
  }
}
