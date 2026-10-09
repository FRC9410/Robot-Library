// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.subsystems;

import com.ctre.phoenix6.CANBus;
import com.ctre.phoenix6.configs.MotorOutputConfigs;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.configs.ParentConfiguration;
import com.ctre.phoenix6.configs.Slot0Configs;
import com.ctre.phoenix6.configs.FeedbackConfigs;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.MagnetSensorConfigs;
import com.ctre.phoenix6.hardware.CANcoder;
import com.ctre.phoenix6.StatusCode;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotBase;
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
import java.util.Objects;
import java.util.function.DoublePredicate;
import java.util.function.Function;

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
  private final Map<Integer, Boolean> brakeModeByCanId;
  private final Map<Integer, Boolean> followerByCanId;
  private final Map<Integer, Boolean> reversedByCanId;
  private Integer leaderCanId;
  private String subsystemName;
  private boolean configured = true;
  private final Map<String, Object> rejectedTuning = new HashMap<>();
  private final frc.powerlib.tuning.TuningCadence tuningCadence = new frc.powerlib.tuning.TuningCadence();
  protected static final double CONFIG_TIMEOUT_SECONDS = 0.05;
  private final ConfigurationQueue configurationQueue =
      new ConfigurationQueue(message -> DriverStation.reportWarning(message, false));

  protected final boolean pendingConfiguration(TalonFX motor, Class<?> group) {
    return configurationQueue.pending(motor.getDeviceID() + "/" + group.getSimpleName());
  }

  protected final boolean applyRuntimeConfiguration(TalonFX motor, ParentConfiguration config) {
    String key = motor.getDeviceID() + "/" + config.getClass().getSimpleName();
    return configurationQueue.request(key, config.serialize(), () -> {
      if (config instanceof Slot0Configs slot) return motor.getConfigurator().apply(slot, CONFIG_TIMEOUT_SECONDS);
      if (config instanceof FeedbackConfigs feedback) return motor.getConfigurator().apply(feedback, CONFIG_TIMEOUT_SECONDS);
      if (config instanceof MotionMagicConfigs motion) return motor.getConfigurator().apply(motion, CONFIG_TIMEOUT_SECONDS);
      if (config instanceof MotorOutputConfigs output) return motor.getConfigurator().apply(output, CONFIG_TIMEOUT_SECONDS);
      throw new IllegalArgumentException("Unsupported runtime config: " + config.getClass());
    });
  }

  protected final boolean pendingEncoderConfiguration(CANcoder encoder) {
    return configurationQueue.pending("encoder/" + encoder.getDeviceID());
  }

  protected final boolean applyRuntimeConfiguration(CANcoder encoder, MagnetSensorConfigs config) {
    return configurationQueue.request("encoder/" + encoder.getDeviceID(), config.serialize(),
        () -> encoder.getConfigurator().apply(config, CONFIG_TIMEOUT_SECONDS));
  }

  private void checkStartupConfiguration(TalonFX motor, TalonFXConfiguration config) {
    recordStartupConfiguration(motor.getConfigurator().apply(config, CONFIG_TIMEOUT_SECONDS),
        "motor " + motor.getDeviceID());
  }

  /** Sticky startup result: one failed device prevents this subsystem from reporting healthy. */
  protected final void recordStartupConfiguration(StatusCode result, String device) {
    if (!result.isOK()) {
      configured = false;
      DriverStation.reportError("PowerLib " + subsystemName + " startup config for "
          + device + " failed: " + result, false);
    }
  }

  public final boolean isConfigured() {
    return configured;
  }

  /**
   * Constructor for subclasses that register their own motors (e.g. velocity/position configured).
   *
   */
  protected PowerSubsystem(List<MotorConfig> configList, String subsystemName) {
    this(configList, subsystemName, MotorConfiguration::output);
  }

  protected PowerSubsystem(List<MotorConfig> configList, String subsystemName,
      Function<MotorConfig, TalonFXConfiguration> leaderConfiguration) {
    this(configList, subsystemName, leaderConfiguration, !RobotBase.isSimulation());
  }

  protected PowerSubsystem(List<MotorConfig> configList, String subsystemName,
      Function<MotorConfig, TalonFXConfiguration> leaderConfiguration, boolean createHardware) {
    super();

    this.bus = new CANBus(DEFAULT_CAN_BUS_NAME);
    this.motorsByCanId = new HashMap<>();
    this.brakeModeByCanId = new HashMap<>();
    this.followerByCanId = new HashMap<>();
    this.reversedByCanId = new HashMap<>();
    this.subsystemName = subsystemName;

    for (MotorConfig motorConfig : configList) {
      registerMotorTunableState(motorConfig);
    }

    if (!createHardware) return;

    // Get the leader motor and register it
    for (MotorConfig motorConfig : configList) {
      if (!motorConfig.isFollower()) {
        if (this.leaderCanId == null) {
          this.leaderCanId = motorConfig.canId();
        }
        TalonFX motor = createTalonFx(motorConfig.canId());
        checkStartupConfiguration(motor, motorConfig.canId() == leaderCanId
            ? leaderConfiguration.apply(motorConfig) : MotorConfiguration.output(motorConfig));
        motorsByCanId.put(motorConfig.canId(), motor);
      }
    }

    // Register and setup all motors
    for (MotorConfig motorConfig : configList) {
      if (motorConfig.isFollower()) {
        TalonFX motor = createTalonFx(motorConfig.canId());
        checkStartupConfiguration(motor, MotorConfiguration.output(motorConfig));
        motorsByCanId.put(motorConfig.canId(), motor);

        if (this.leaderCanId == null) {
          continue; // Theres no leader to follow so no need to continue
        }

        // Reverse it relative to the leader
        setFollower(motorConfig.canId(), this.leaderCanId, motorConfig.isReversed());
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
    applyMotorOutputConfig(motor, isInverted, neutralMode);
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
      StatusCode status = applyFollower(follower, leaderCanId, inverted);
      recordStartupConfiguration(status, "follower " + followerCanId);
    }
  }

  private static StatusCode applyFollower(TalonFX follower, int leaderCanId, boolean inverted) {
    return follower.setControl(new Follower(leaderCanId,
        inverted ? MotorAlignmentValue.Opposed : MotorAlignmentValue.Aligned));
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
    if (motor != null && (configured || output == 0)) {
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

  protected void setSubsystemData(String key, Object value, String units) {
    frc.powerlib.PowerRobotContainer.setSubsystemData(subsystemName, key, value, units);
  }

  protected void registerSubsystemVariable(String key, double defaultValue) {
    frc.powerlib.PowerRobotContainer.setSubsystemVariableDefault(subsystemName, key, defaultValue);
  }

  protected void registerSubsystemVariable(String key, boolean defaultValue) {
    frc.powerlib.PowerRobotContainer.setSubsystemVariableDefault(subsystemName, key, defaultValue);
  }

  protected double getSubsystemVariable(String key, double defaultValue) {
    return getSubsystemVariable(key, defaultValue, value -> true, "a finite number");
  }

  protected double getPositiveSubsystemVariable(String key, double defaultValue) {
    return getSubsystemVariable(key, defaultValue, value -> value > 0, "a positive finite number");
  }

  protected double getFeedbackRatioSubsystemVariable(String key, double defaultValue) {
    return getSubsystemVariable(key, defaultValue,
        value -> value != 0 && Math.abs(value) <= 1000, "a nonzero finite ratio in [-1000, 1000]");
  }

  protected double getNonnegativeSubsystemVariable(String key, double defaultValue) {
    return getSubsystemVariable(key, defaultValue, value -> value >= 0, "a nonnegative finite number");
  }

  protected double getSubsystemVariable(String key, double defaultValue,
      DoublePredicate valid, String requirement) {
    Object raw = frc.powerlib.PowerRobotContainer.getSubsystemVariable(subsystemName, key, (Object) defaultValue);
    double value;
    try {
      value = raw instanceof Number number ? number.doubleValue()
          : raw instanceof String text ? Double.parseDouble(text) : Double.NaN;
    } catch (NumberFormatException exception) {
      value = Double.NaN;
    }
    if (Double.isFinite(value) && valid.test(value)) {
      rejectedTuning.remove(key);
      return value;
    }
    if (!Objects.equals(rejectedTuning.put(key, raw), raw)) {
      reportRejectedTuning(subsystemName + "/" + key + " rejected " + raw
          + "; expected " + requirement + ". Keeping " + defaultValue);
    }
    return defaultValue;
  }

  protected void reportRejectedTuning(String message) {
    DriverStation.reportWarning("PowerLib tuning: " + message, false);
  }

  protected boolean getSubsystemVariable(String key, boolean defaultValue) {
    return frc.powerlib.PowerRobotContainer.getSubsystemVariable(subsystemName, key, defaultValue);
  }

  protected void applyMotorTunableValues() {
    if (!frc.powerlib.PowerRobotContainer.isTuningEnabled()) return;
    for (int canId : reversedByCanId.keySet()) {
      TalonFX motor = getMotorById(canId);
      if (motor == null) continue;
      boolean brake = getSubsystemVariable(getMotorVariableKey(canId, "BrakeMode"), brakeModeByCanId.get(canId));
      boolean reversed = getSubsystemVariable(getMotorVariableKey(canId, "Reversed"), reversedByCanId.get(canId));
      boolean follower = followerByCanId.getOrDefault(canId, false);
      String followerKey = "follower/" + canId;
      if (follower && leaderCanId != null
          && (reversed != reversedByCanId.get(canId) || configurationQueue.pending(followerKey))) {
        if (configurationQueue.request(followerKey, Boolean.toString(reversed),
            () -> applyFollower(motor, leaderCanId, reversed))) {
          reversedByCanId.put(canId, reversed);
        }
      }
      if (brake != brakeModeByCanId.get(canId) || (!follower && reversed != reversedByCanId.get(canId))
          || pendingConfiguration(motor, MotorOutputConfigs.class)) {
        MotorOutputConfigs output = new MotorOutputConfigs();
        output.NeutralMode = brake ? NeutralModeValue.Brake : NeutralModeValue.Coast;
        output.Inverted = !follower && reversed ? InvertedValue.Clockwise_Positive : InvertedValue.CounterClockwise_Positive;
        if (applyRuntimeConfiguration(motor, output)) {
          brakeModeByCanId.put(canId, brake);
          if (!follower) reversedByCanId.put(canId, reversed);
        }
      }
    }
  }

  /** Call once per periodic loop to gate motor and mechanism tuning together. */
  protected final boolean shouldSyncTuning() {
    return frc.powerlib.PowerRobotContainer.isTuningEnabled() && tuningCadence.isDue();
  }

  private void registerMotorTunableState(MotorConfig motorConfig) {
    int canId = motorConfig.canId();
    boolean brakeMode = motorConfig.neutralMode() == NeutralModeValue.Brake;
    boolean reversed = motorConfig.isReversed();

    brakeModeByCanId.put(canId, brakeMode);
    followerByCanId.put(canId, motorConfig.isFollower());
    reversedByCanId.put(canId, reversed);
    registerSubsystemVariable(getMotorVariableKey(canId, "BrakeMode"), brakeMode);
    registerSubsystemVariable(getMotorVariableKey(canId, "Reversed"), reversed);
  }

  private String getMotorVariableKey(int canId, String key) {
    return "Motors/" + canId + "/" + key;
  }

  private static void applyMotorOutputConfig(
      TalonFX motor, boolean reversed, NeutralModeValue neutralMode) {
    MotorOutputConfigs motorOutputConfigs = new MotorOutputConfigs();
    motorOutputConfigs.Inverted =
        reversed ? InvertedValue.Clockwise_Positive : InvertedValue.CounterClockwise_Positive;
    motorOutputConfigs.NeutralMode = neutralMode;
    motor.getConfigurator().apply(motorOutputConfigs);
  }

  protected static boolean isRunningVelocity(double rotationsPerSecond) {
    return Double.isFinite(rotationsPerSecond) && Math.abs(rotationsPerSecond) > 0.1;
  }

  protected static boolean changed(double left, double right) {
    return Math.abs(left - right) > 1.0e-9;
  }

  public boolean isMotorRunning(int id) {
    TalonFX motor = motorsByCanId.get(id);
    return motor != null && isRunningVelocity(motor.getVelocity().getValueAsDouble());
  }

  public boolean isAllMotorsRunning () {
    if (!configured || motorsByCanId.isEmpty()) return false;
    for (int key : motorsByCanId.keySet()) {
      
      if (!isMotorRunning(key)) {
        return false; 
      }

    }

    return true;
  }
}


