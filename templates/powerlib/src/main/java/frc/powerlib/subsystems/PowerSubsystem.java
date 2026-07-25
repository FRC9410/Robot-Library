// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.subsystems;

import com.ctre.phoenix6.CANBus;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.controls.Follower;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.signals.InvertedValue;
import com.ctre.phoenix6.signals.MotorAlignmentValue;
import com.ctre.phoenix6.signals.NeutralModeValue;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.configs.MotorConfig;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * PowerSubsystem: extensible subsystem with helpers for controlling devices by CAN ID.
 * Use {@link #registerMotor(int)}, {@link #setOutput(int, double)}, and related helpers
 * to add and control TalonFX devices without duplicating setup code.
 * <p>
 * Provides helpers for publishing telemetry and registering live-tunable values under the
 * subsystem's PowerLib NetworkTables path.
 */
public abstract class PowerSubsystem extends SubsystemBase {

  private static final String DEFAULT_CAN_BUS_NAME = "canivore";

  private final CANBus bus;
  private final Map<Integer, TalonFX> motorsByCanId;
  private Integer leaderCanId;
  private String subsystemName;

  /**
   * Constructor for subclasses that register their own motors (e.g. velocity/position configured).
   *
   */
  protected PowerSubsystem(List<MotorConfig> configList, String subsystemName) {
    super();

    this.bus = new CANBus(DEFAULT_CAN_BUS_NAME);
    this.motorsByCanId = new HashMap<>();
    this.subsystemName = subsystemName;

    // Get the leader motor and register it
    for (MotorConfig motorConfig : configList) {
      if (!motorConfig.isFollower()) {
        if (this.leaderCanId == null) {
          this.leaderCanId = motorConfig.canId();
        }
        registerMotor(motorConfig.canId(), motorConfig.neutralMode(), motorConfig.isReversed());
      }
    }

    // Register and setup all motors
    for (MotorConfig motorConfig : configList) {
      if (motorConfig.isFollower()) {
        registerMotor(motorConfig.canId(), motorConfig.neutralMode());

        if (this.leaderCanId == null) {
          continue; // Theres no leader to follow so no need to continue
        }

        // Reverse it relative to the leader
        if (motorConfig.isReversed()) {
          setFollower(motorConfig.canId(), this.leaderCanId, true);
        }
      }
    }
  }

  /** Returns the CAN bus used by this subsystem (for subclasses that build custom devices). */
  protected CANBus getBus() {
    return bus;
  }

  // ---------- CAN ID helpers (extensibility) ----------

  /**
   * Creates a TalonFX on the subsystem's CAN bus. Use this or {@link #createTalonFx(int,
   * NeutralModeValue)} when building devices for registration.
   */
  public TalonFX createTalonFx(int canId) {
    return new TalonFX(canId, bus);
  }

  /**
   * Creates a TalonFX on the subsystem's CAN bus with the given neutral mode.
   */
  public TalonFX createTalonFx(int canId, NeutralModeValue neutralMode) {
    TalonFX motor = createTalonFx(canId);
    motor.setNeutralMode(neutralMode);
    return motor;
  }

  /**
   * Registers a new TalonFX by CAN ID (creates it on the default bus with brake neutral mode).
   * Enables control via {@link #setOutput(int, double)}, {@link #stop(int)}, {@link #getMotorById(int)}.
   */
  public TalonFX registerMotor(int canId) {
    return registerMotor(canId, NeutralModeValue.Brake);
  }

  /**
   * Registers a new TalonFX by CAN ID with the given neutral mode.
   */
  public TalonFX registerMotor(int canId, NeutralModeValue neutralMode) {
    if (leaderCanId == null) {
      leaderCanId = canId;
    }
    TalonFX motor = createTalonFx(canId, neutralMode);
    motorsByCanId.put(canId, motor);
    return motor;
  }

  public TalonFX registerMotor(int canId, NeutralModeValue neutralMode, boolean isInverted) {
    if (leaderCanId == null) {
      leaderCanId = canId;
    }
    TalonFX motor = createTalonFx(canId, neutralMode);
    if (isInverted) {
      TalonFXConfiguration cfg = new TalonFXConfiguration();
      cfg.MotorOutput.Inverted = InvertedValue.CounterClockwise_Positive;
      motor.getConfigurator().apply(cfg);
    }
    motorsByCanId.put(canId, motor);
    return motor;
  }
  

  /**
   * Registers an existing TalonFX under a CAN ID so it can be controlled by {@link #setOutput(int,
   * double)} and other helpers.
   */
  public void registerMotor(int canId, TalonFX motor) {
    if (leaderCanId == null) {
      leaderCanId = canId;
    }
    motorsByCanId.put(canId, motor);
  }

  /**
   * Configures a motor as a follower of another (by leader CAN ID). Leader must already be
   * registered or exist on the bus.
   */
  public void setFollower(int followerCanId, int leaderCanId, boolean inverted) {
    TalonFX follower = getMotorById(followerCanId);
    if (follower != null) {
      follower.setControl(
        new Follower(leaderCanId, inverted ? MotorAlignmentValue.Opposed : MotorAlignmentValue.Aligned)
      );
    }
  }

  /**
   * Returns an unmodifiable view of all motors by CAN ID. For use by subclasses only.
   */
  protected Map<Integer, TalonFX> getMotors() {
    return Collections.unmodifiableMap(motorsByCanId);
  }

  /**
   * Returns the TalonFX registered for the given CAN ID, or null if not registered.
   * For use by subclasses only.
   */
  protected TalonFX getMotorById(int canId) {
    return motorsByCanId.get(canId);
  }

  /**
   * Returns the leader (first registered / first non-follower) motor, or null if none.
   * For use by subclasses only.
   */
  protected TalonFX getLeaderMotor() {
    return leaderCanId == null ? null : motorsByCanId.get(leaderCanId);
  }

  /** Sets percent output for the device at the given CAN ID (if registered). */
  public void setOutput(int canId, double output) {
    TalonFX motor = motorsByCanId.get(canId);
    if (motor != null) {
      motor.set(output);
    }
  }

  /** Stops the device at the given CAN ID (if registered). */
  public void stop(int canId) {
    setOutput(canId, 0);
  }

  /** Stops all registered motors. */
  public void stopAll() {
    for (TalonFX motor : motorsByCanId.values()) {
      motor.set(0);
    }
  }

  /** Sets neutral mode for a registered motor. */
  public void setNeutralMode(int canId, NeutralModeValue mode) {
    TalonFX motor = motorsByCanId.get(canId);
    if (motor != null) {
      motor.setNeutralMode(mode);
    }
  }

  /** Whether a motor is registered for the given CAN ID. */
  public boolean hasMotor(int canId) {
    return motorsByCanId.containsKey(canId);
  }

  @Override
  public void periodic() {}

  protected String getSubsystemName() {
    return subsystemName;
  }

  protected void setSubsystemData(String key, Object value) {
    frc.powerlib.PowerRobotContainer.setSubsystemData(subsystemName, key, value);
  }

  protected void registerSubsystemVariable(String key, double defaultValue) {
    frc.powerlib.PowerRobotContainer.setSubsystemVariableDefault(subsystemName, key, defaultValue);
  }

  protected double getSubsystemVariable(String key, double defaultValue) {
    return frc.powerlib.PowerRobotContainer.getSubsystemVariable(subsystemName, key, defaultValue);
  }

  public boolean isMotorRunning (int id) {
    return motorsByCanId.get(id).getVelocity().getValueAsDouble() == 0.0;
  }

  public boolean isAllMotorsRunning () {
    for (int key : motorsByCanId.keySet()) {
      
      if (!isMotorRunning(key)) {
        return false; 
      }

    }

    return true;
  }
}


