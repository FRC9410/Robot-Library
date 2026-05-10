// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.configs;

/** Motion Magic profiler configuration: cruise velocity and acceleration. No leader CAN ID. */
public record MotionMagicConfig(double cruiseVelocity, double acceleration) {

  /** Builds a MotionMagicConfig for velocity control (cruise velocity unused; use acceleration only). */
  public static MotionMagicConfig forVelocity(double acceleration) {
    return new MotionMagicConfig(0, acceleration);
  }
}

