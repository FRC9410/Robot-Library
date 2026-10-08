// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.configs;

/** CANcoder (absolute encoder) configuration: encoder CAN ID, magnet offset, and discontinuity point. */
public record CancoderConfig(
    int encoderId,
    double magnetOffsetRotations,
    double discontinuityPointRotations) {
  public CancoderConfig {
    ConfigValidation.range(encoderId, 0, 62, "encoder CAN ID");
    ConfigValidation.range(magnetOffsetRotations, -1, 1, "magnetOffsetRotations");
    ConfigValidation.range(discontinuityPointRotations, 0, 1, "discontinuityPointRotations");
  }
}

