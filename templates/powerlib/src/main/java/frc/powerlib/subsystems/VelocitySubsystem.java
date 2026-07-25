// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.subsystems;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.Slot0Configs;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
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
  private String subsystemName;
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
    super(config.motorConfigs(), config.subsystemName());
    TalonFX leader = getLeaderMotor();
    if (leader != null) {
      configureMotorForVelocity(leader, config.leadConfig(), config.motionMagicConfig());
      this.velocityMotor = leader;
    }
    this.subsystemName = config.subsystemName();
    this.focEnabled = config.leadConfig().focEnabled();
    this.torqueFeedForward = config.torqueFeedForward();
    this.velocitySetpoint = 0.0;
    initializeTunableState(config.leadConfig(), config.motionMagicConfig());
    this.io = io == null ? createDefaultIO() : io;
  }

  protected VelocitySubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? new VelocitySubsystemIOSim() : new VelocitySubsystemIOReal(this);
  }

  @Override
  public void periodic() {
    io.updateInputs(inputs);
    applyTunableValues();
    SignalLogger.writeDouble(subsystemName + " Velocity", inputs.velocityRotationsPerSecond, "rotations per second");
    setSubsystemData("Velocity", inputs.velocityRotationsPerSecond);
    setSubsystemData("VelocitySetpoint", inputs.velocitySetpoint);
    setSubsystemData("AppliedVolts", inputs.appliedVolts);
    setSubsystemData("Connected", inputs.connected);
  }

  /**
   * Applies lead and motion magic config to an existing TalonFX for velocity control.
   */
  private static void configureMotorForVelocity(
      TalonFX motor,
      LeadMotorConfig leadConfig,
      MotionMagicConfig motionMagicConfig) {
    TalonFXConfiguration config = new TalonFXConfiguration();
    config.Slot0.kP = leadConfig.kP();
    config.Slot0.kI = leadConfig.kI();
    config.Slot0.kD = leadConfig.kD();
    config.Slot0.kG = leadConfig.kG();
    if (leadConfig.kS().isPresent()) {
      config.Slot0.kS = leadConfig.kS().get();
      config.Slot0.kV = leadConfig.kV().get();
      config.Slot0.kA = leadConfig.kA().get();
    }

    MotionMagicConfigs motionMagicConfigs = new MotionMagicConfigs();
    motionMagicConfigs.withMotionMagicCruiseVelocity(motionMagicConfig.cruiseVelocity());
    motionMagicConfigs.withMotionMagicAcceleration(motionMagicConfig.acceleration());

    motor.getConfigurator().apply(config);
    motor.getConfigurator().apply(motionMagicConfigs);
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
    motionMagicCruiseVelocity = motionMagicConfig.cruiseVelocity();
    motionMagicAcceleration = motionMagicConfig.acceleration();

    registerSubsystemVariable("PID/kP", kP);
    registerSubsystemVariable("PID/kI", kI);
    registerSubsystemVariable("PID/kD", kD);
    registerSubsystemVariable("PID/kG", kG);
    registerSubsystemVariable("Feedforward/kS", kS);
    registerSubsystemVariable("Feedforward/kV", kV);
    registerSubsystemVariable("Feedforward/kA", kA);
    registerSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    registerSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
  }

  private void applyTunableValues() {
    if (velocityMotor == null) {
      return;
    }

    double nextKP = getSubsystemVariable("PID/kP", kP);
    double nextKI = getSubsystemVariable("PID/kI", kI);
    double nextKD = getSubsystemVariable("PID/kD", kD);
    double nextKG = getSubsystemVariable("PID/kG", kG);
    double nextKS = getSubsystemVariable("Feedforward/kS", kS);
    double nextKV = getSubsystemVariable("Feedforward/kV", kV);
    double nextKA = getSubsystemVariable("Feedforward/kA", kA);

    if (changed(nextKP, kP)
        || changed(nextKI, kI)
        || changed(nextKD, kD)
        || changed(nextKG, kG)
        || changed(nextKS, kS)
        || changed(nextKV, kV)
        || changed(nextKA, kA)) {
      Slot0Configs slot0 = new Slot0Configs();
      slot0.kP = nextKP;
      slot0.kI = nextKI;
      slot0.kD = nextKD;
      slot0.kG = nextKG;
      slot0.kS = nextKS;
      slot0.kV = nextKV;
      slot0.kA = nextKA;
      velocityMotor.getConfigurator().apply(slot0);

      kP = nextKP;
      kI = nextKI;
      kD = nextKD;
      kG = nextKG;
      kS = nextKS;
      kV = nextKV;
      kA = nextKA;
    }

    double nextCruiseVelocity =
        getSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    double nextAcceleration = getSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
    if (changed(nextCruiseVelocity, motionMagicCruiseVelocity)
        || changed(nextAcceleration, motionMagicAcceleration)) {
      MotionMagicConfigs motionMagicConfigs = new MotionMagicConfigs();
      motionMagicConfigs.withMotionMagicCruiseVelocity(nextCruiseVelocity);
      motionMagicConfigs.withMotionMagicAcceleration(nextAcceleration);
      velocityMotor.getConfigurator().apply(motionMagicConfigs);
      motionMagicCruiseVelocity = nextCruiseVelocity;
      motionMagicAcceleration = nextAcceleration;
    }
  }

  private static boolean changed(double left, double right) {
    return Math.abs(left - right) > 1.0e-9;
  }

  /**
   * Sets velocity setpoint (e.g. rotations per second) using Motion Magic. Override or use
   * directly after {@link #velocityMotor} is set.
   */
  public void setVelocity(double velocityRotationsPerSecond) {
    velocitySetpoint = velocityRotationsPerSecond;
    io.setVelocity(velocityRotationsPerSecond);
  }

  public void setVelocityWithoutFOC(double velocityRotationsPerSecond) {
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
    return velocityMotor.getVelocity().getValueAsDouble() <= 0.1;
  }
  
  public void brake () {
    io.brake();
  }
}
