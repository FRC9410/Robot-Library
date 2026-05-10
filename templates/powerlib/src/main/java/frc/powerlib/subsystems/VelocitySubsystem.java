// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.subsystems;

import com.ctre.phoenix6.controls.MotionMagicVelocityVoltage;
import com.ctre.phoenix6.controls.NeutralOut;
import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.signals.NeutralModeValue;

import frc.powerlib.PowerRobotContainer;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.configs.VelocitySubsystemConfig;


public class VelocitySubsystem extends PowerSubsystem {

  /** Primary velocity-controlled motor; set in subclass after init. */
  protected TalonFX velocityMotor;
  private String subsystemName;
  private static final NeutralOut brake = new NeutralOut();
  /**
   * Constructor that uses the leader motor from the config and configures it with lead and motion
   * magic settings from the same config.
   *
   * @param config single config containing motor configs, lead, motion magic, and name
   */
  public VelocitySubsystem(VelocitySubsystemConfig config) {
    super(config.motorConfigs(), config.subsystemName());
    TalonFX leader = getLeaderMotor();
    if (leader != null) {
      configureMotorForVelocity(leader, config.leadConfig(), config.motionMagicConfig());
      this.velocityMotor = leader;
    }
    this.subsystemName = config.subsystemName();
  }

  @Override
  public void periodic() {
    SignalLogger.writeDouble(subsystemName + " Velocity", getLeaderMotor().getRotorVelocity().getValueAsDouble(), "rotations per second");
    PowerRobotContainer.setData(subsystemName + "Velocity", getLeaderMotor().getRotorVelocity().getValueAsDouble());
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
    motionMagicConfigs.withMotionMagicAcceleration(motionMagicConfig.acceleration());

    motor.getConfigurator().apply(config);
    motor.getConfigurator().apply(motionMagicConfigs);
  }

  /**
   * Sets velocity setpoint (e.g. rotations per second) using Motion Magic. Override or use
   * directly after {@link #velocityMotor} is set.
   */
  public void setVelocity(double velocityRotationsPerSecond) {
    if (velocityMotor != null) {
      velocityMotor.setControl(
          new MotionMagicVelocityVoltage(0).withVelocity(velocityRotationsPerSecond).withEnableFOC(true).withSlot(0));
    }
  }

  /** Stops the velocity motor. */
  public void stopVelocity() {
    setVelocity(0);
  }

  /**
   * Applies the given voltage to the velocity motor (leader only; followers follow).
   * Use for SysId characterization. Voltage is in volts.
   */
  public void setVoltage(double volts) {
    if (velocityMotor != null) {
      velocityMotor.setVoltage(volts);
    }
  }

  /** Returns the primary velocity motor (if initialized). */
  public TalonFX getVelocityMotor() {
    return velocityMotor;
  }

  public boolean isRunning () {
    return velocityMotor.getVelocity().getValueAsDouble() <= 0.1;
  }
  
  public void brake () {
    velocityMotor.setControl(brake);
  }
}
