// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.configs;

import java.util.List;

/**
 * Single-parameter config for {@link frc.powerlib.subsystems.VelocitySubsystem}.
 * Holds motor configs, lead/motion magic configs, and display name.
 */
public record VelocitySubsystemConfig(
    List<MotorConfig> motorConfigs,
    LeadMotorConfig leadConfig,
    MotionMagicConfig motionMagicConfig,
    String subsystemName,
    double torqueFeedForward) {
  public VelocitySubsystemConfig(
      List<MotorConfig> motorConfigs,
      LeadMotorConfig leadConfig,
      MotionMagicConfig motionMagicConfig,
      String subsystemName) {
    this(motorConfigs, leadConfig, motionMagicConfig, subsystemName, 0.0);
  }
}

