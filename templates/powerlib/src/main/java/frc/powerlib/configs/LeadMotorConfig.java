// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.configs;

import java.util.Optional;

/**
 * Lead (leader) motor configuration: PID and feedback ratios for the primary position motor.
 * Use with {@link CancoderConfig} and {@link MotionMagicConfig} for full position setup.
 */
public record LeadMotorConfig(
    double kP,
    double kI,
    double kD,
    double kG, 
    Optional<Double> kS,
    Optional<Double> kV,
    Optional<Double> kA,
    double sensorToMechanismRatio,
    double rotorToSensorRatio,
    boolean focEnabled) {
  public LeadMotorConfig(
      double kP,
      double kI,
      double kD,
      double kG,
      Optional<Double> kS,
      Optional<Double> kV,
      Optional<Double> kA,
      double sensorToMechanismRatio,
      double rotorToSensorRatio) {
    this(kP, kI, kD, kG, kS, kV, kA, sensorToMechanismRatio, rotorToSensorRatio, true);
  }
}

