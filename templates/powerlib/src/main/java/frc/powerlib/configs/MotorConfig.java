// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.configs;

import com.ctre.phoenix6.signals.NeutralModeValue;

/** Immutable config for a single motor: CAN ID, type, neutral mode, follower flag, and direction. */
public class MotorConfig {

  public enum MotorType { X60, X44 }

  private final int canId;
  private final NeutralModeValue neutralMode;
  private final boolean isFollower;
  private final boolean isReversed;
  private final MotorType motorType;

  public MotorConfig(int canId, NeutralModeValue neutralMode, boolean isFollower, boolean isReversed) {
    this(canId, neutralMode, isFollower, isReversed, MotorType.X60);
  }

  public MotorConfig(int canId, NeutralModeValue neutralMode, boolean isFollower, boolean isReversed, MotorType motorType) {
    ConfigValidation.range(canId, 0, 62, "motor CAN ID");
    java.util.Objects.requireNonNull(neutralMode, "neutralMode");
    this.canId = canId;
    this.neutralMode = neutralMode;
    this.isFollower = isFollower;
    this.isReversed = isReversed;
    this.motorType = java.util.Objects.requireNonNull(motorType, "motorType");
  }

  public MotorType motorType() { return motorType; }

  public int canId() {
    return canId;
  }

  public NeutralModeValue neutralMode() {
    return neutralMode;
  }

  public boolean isFollower() {
    return isFollower;
  }

  public boolean isReversed() {
    return isReversed;
  }

  /**
   * Creates a leader motor config (not a follower, not reversed).
   *
   * @param canId CAN ID of the motor
   * @param neutralMode brake or coast
   */
  public static MotorConfig leader(int canId, NeutralModeValue neutralMode) {
    return new MotorConfig(canId, neutralMode, false, false);
  }

  /**
   * Creates a leader motor config (not a follower, not reversed).
   *
   * @param canId CAN ID of the motor
   * @param neutralMode brake or coast
   */
  public static MotorConfig leader(int canId, NeutralModeValue neutralMode, boolean isReversed) {
    return new MotorConfig(canId, neutralMode, false, isReversed);
  }

  public static MotorConfig leader(int canId, NeutralModeValue neutralMode, boolean isReversed, MotorType motorType) {
    return new MotorConfig(canId, neutralMode, false, isReversed, motorType);
  }

  /**
   * Creates a follower motor config.
   *
   * @param canId CAN ID of the follower motor
   */
  public static MotorConfig follower(int canId) {
    return new MotorConfig(canId, NeutralModeValue.Brake, true, false);
  }

  /**
   * Creates a follower motor config.
   *
   * @param canId CAN ID of the follower motor
   */
  public static MotorConfig follower(int canId, boolean reversed) {
    return new MotorConfig(canId, NeutralModeValue.Brake, true, reversed);
  }

  /**
   * Creates a follower motor config.
   *
   * @param canId CAN ID of the follower motor
   * @param neutralMode brake or coast
   */
  public static MotorConfig follower(int canId, NeutralModeValue neutralMode) {
    return new MotorConfig(canId, neutralMode, true, false);
  }

  /**
   * Creates a follower motor config.
   *
   * @param canId CAN ID of the follower motor
   * @param neutralMode brake or coast
   */
  public static MotorConfig follower(int canId, NeutralModeValue neutralMode, boolean reversed) {
    return new MotorConfig(canId, neutralMode, true, reversed);
  }

  public static MotorConfig follower(int canId, NeutralModeValue neutralMode, boolean reversed, MotorType motorType) {
    return new MotorConfig(canId, neutralMode, true, reversed, motorType);
  }
}

