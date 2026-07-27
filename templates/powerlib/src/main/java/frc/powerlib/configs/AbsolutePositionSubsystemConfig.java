// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.configs;

import java.util.List;
import java.util.Optional;

/**
 * Single-parameter config for {@link frc.powerlib.subsystems.AbsolutePositionSubsystem}.
 * Holds motor configs, lead/CANcoder/motion magic configs, and display name/units.
 */
public record AbsolutePositionSubsystemConfig(
    List<MotorConfig> motorConfigs,
    LeadMotorConfig leadConfig,
    CancoderConfig cancoderConfig,
    MotionMagicConfig motionMagicConfig,
    String subsystemName,
    String units,
    Optional<Double> defaultPosition) {}

