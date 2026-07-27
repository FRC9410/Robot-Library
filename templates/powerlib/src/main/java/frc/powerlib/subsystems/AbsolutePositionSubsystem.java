// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.subsystems;

import static edu.wpi.first.units.Units.Rotations;

import com.ctre.phoenix6.BaseStatusSignal;
import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.configs.CANcoderConfiguration;
import com.ctre.phoenix6.configs.FeedbackConfigs;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.Slot0Configs;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.controls.MotionMagicVoltage;
import com.ctre.phoenix6.hardware.CANcoder;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.signals.FeedbackSensorSourceValue;
import com.ctre.phoenix6.signals.SensorDirectionValue;
import com.ctre.phoenix6.CANBus;
import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.configs.CancoderConfig;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.configs.AbsolutePositionSubsystemConfig;
import frc.powerlib.subsystems.io.AbsolutePositionSubsystemIO;
import frc.powerlib.subsystems.io.AbsolutePositionSubsystemIOReal;
import frc.powerlib.subsystems.io.AbsolutePositionSubsystemIOSim;

import java.util.Optional;

public class AbsolutePositionSubsystem extends PowerSubsystem {

  private static final String DEFAULT_CAN_BUS_NAME = "canivore";

  /** Primary position-controlled motor (with fused CANcoder from config constructor). */
  protected TalonFX positionMotor;
  private CANcoder cancoder;
  public final AbsolutePositionSubsystemIO.Inputs inputs = new AbsolutePositionSubsystemIO.Inputs();
  private final AbsolutePositionSubsystemIO io;
  private String subsystemName;
  private String units;
  private boolean focEnabled;
  private double kP;
  private double kI;
  private double kD;
  private double kG;
  private double kS;
  private double kV;
  private double kA;
  private int cancoderId;
  private double cancoderMagnetOffsetRotations;
  private double cancoderDiscontinuityPointRotations;
  private double sensorToMechanismRatio;
  private double rotorToSensorRatio;
  private double motionMagicCruiseVelocity;
  private double motionMagicAcceleration;
  private double defaultPosition;

  /** Last commanded position setpoint in rotations. */
  private double setpointRotations;

  /**
   * Constructor that uses the leader motor from the config and configures it with lead, CANcoder,
   * and motion magic settings from the same config.
   *
   * @param config single config containing motor configs, lead, CANcoder, motion magic, name, and units
   */
  public AbsolutePositionSubsystem(AbsolutePositionSubsystemConfig config) {
    this(config, null);
  }

  public AbsolutePositionSubsystem(AbsolutePositionSubsystemConfig config, AbsolutePositionSubsystemIO io) {
    super(config.motorConfigs(), config.subsystemName());
    TalonFX leader = getLeaderMotor();
    this.cancoder = new CANcoder(config.cancoderConfig().encoderId(), new CANBus(DEFAULT_CAN_BUS_NAME));
    if (leader != null) {
      configureMotorWithCancoder(leader, cancoder, config.leadConfig(), config.cancoderConfig(), config.motionMagicConfig(), config.defaultPosition());
      this.positionMotor = leader;
    }
    this.subsystemName = config.subsystemName();
    this.units = config.units();
    this.focEnabled = config.leadConfig().focEnabled();
    this.cancoderId = config.cancoderConfig().encoderId();
    this.setpointRotations = config.defaultPosition().orElseGet(() -> leader != null ? leader.getPosition().getValueAsDouble() : 0.0);
    initializeTunableState(config.leadConfig(), config.cancoderConfig(), config.motionMagicConfig(), config.defaultPosition());
    this.io = io == null ? createDefaultIO() : io;
  }

  private AbsolutePositionSubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? new AbsolutePositionSubsystemIOSim() : new AbsolutePositionSubsystemIOReal(this);
  }

  @Override
  public void periodic() {
    io.updateInputs(inputs);
    applyMotorTunableValues();
    applyTunableValues();
    SignalLogger.writeDouble(subsystemName + " Position", inputs.positionRotations, units);
    setSubsystemData("Position", inputs.positionRotations);
    setSubsystemData("SetpointRotations", inputs.setpointRotations);
    setSubsystemData("AppliedVolts", inputs.appliedVolts);
    setSubsystemData("Connected", inputs.connected);
  }

  /**
   * Configures an existing TalonFX with a CANcoder and the given lead, CANcoder, and motion magic
   * configs. Used by the config-list constructor.
   */
  private static void configureMotorWithCancoder(
      TalonFX motor,
      CANcoder cancoder,
      LeadMotorConfig leadConfig,
      CancoderConfig cancoderConfig,
      MotionMagicConfig motionMagicConfig,
      Optional<Double> defaultPos) {
    applyCancoderConfig(
        cancoder,
        cancoderConfig.magnetOffsetRotations(),
        cancoderConfig.discontinuityPointRotations());

    TalonFXConfiguration talonConfig = new TalonFXConfiguration();
    talonConfig.Slot0.kP = leadConfig.kP();
    talonConfig.Slot0.kI = leadConfig.kI();
    talonConfig.Slot0.kD = leadConfig.kD();
    talonConfig.Slot0.kG = leadConfig.kG();
    if (leadConfig.kS().isPresent()) {
      talonConfig.Slot0.kS = leadConfig.kS().get();
      talonConfig.Slot0.kV = leadConfig.kV().get();
      talonConfig.Slot0.kA = leadConfig.kA().get();
    }
    talonConfig.Feedback.FeedbackRemoteSensorID = cancoder.getDeviceID();
    talonConfig.Feedback.FeedbackSensorSource = FeedbackSensorSourceValue.FusedCANcoder;
    talonConfig.Feedback.SensorToMechanismRatio = leadConfig.sensorToMechanismRatio();
    talonConfig.Feedback.RotorToSensorRatio = leadConfig.rotorToSensorRatio();

    motor.getConfigurator().apply(talonConfig);

    MotionMagicConfigs mmConfigs = new MotionMagicConfigs();
    mmConfigs
        .withMotionMagicCruiseVelocity(motionMagicConfig.cruiseVelocity())
        .withMotionMagicAcceleration(motionMagicConfig.acceleration());
    motor.getConfigurator().apply(mmConfigs);

    BaseStatusSignal.setUpdateFrequencyForAll(100, cancoder.getPosition(), cancoder.getVelocity());

    double targetPos = defaultPos.isEmpty() ?  motor.getPosition().getValueAsDouble() : defaultPos.get();

    motor.setControl(new MotionMagicVoltage(0).withPosition(targetPos).withSlot(0).withEnableFOC(leadConfig.focEnabled()));
  }

  private void initializeTunableState(
      LeadMotorConfig leadConfig,
      CancoderConfig cancoderConfig,
      MotionMagicConfig motionMagicConfig,
      Optional<Double> configuredDefaultPosition) {
    kP = leadConfig.kP();
    kI = leadConfig.kI();
    kD = leadConfig.kD();
    kG = leadConfig.kG();
    kS = leadConfig.kS().orElse(0.0);
    kV = leadConfig.kV().orElse(0.0);
    kA = leadConfig.kA().orElse(0.0);
    cancoderMagnetOffsetRotations = cancoderConfig.magnetOffsetRotations();
    cancoderDiscontinuityPointRotations = cancoderConfig.discontinuityPointRotations();
    sensorToMechanismRatio = leadConfig.sensorToMechanismRatio();
    rotorToSensorRatio = leadConfig.rotorToSensorRatio();
    motionMagicCruiseVelocity = motionMagicConfig.cruiseVelocity();
    motionMagicAcceleration = motionMagicConfig.acceleration();
    defaultPosition = configuredDefaultPosition.orElse(setpointRotations);

    registerSubsystemVariable("Control/FOCEnabled", focEnabled);
    registerSubsystemVariable("PID/kP", kP);
    registerSubsystemVariable("PID/kI", kI);
    registerSubsystemVariable("PID/kD", kD);
    registerSubsystemVariable("PID/kG", kG);
    registerSubsystemVariable("Feedforward/kS", kS);
    registerSubsystemVariable("Feedforward/kV", kV);
    registerSubsystemVariable("Feedforward/kA", kA);
    registerSubsystemVariable("Cancoder/MagnetOffset", cancoderMagnetOffsetRotations);
    registerSubsystemVariable("Cancoder/DiscontinuityPoint", cancoderDiscontinuityPointRotations);
    registerSubsystemVariable("Ratios/SensorToMechanism", sensorToMechanismRatio);
    registerSubsystemVariable("Ratios/RotorToSensor", rotorToSensorRatio);
    registerSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    registerSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
    registerSubsystemVariable("Position/Default", defaultPosition);
  }

  private void applyTunableValues() {
    if (positionMotor == null) {
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
      positionMotor.getConfigurator().apply(slot0);

      kP = nextKP;
      kI = nextKI;
      kD = nextKD;
      kG = nextKG;
      kS = nextKS;
      kV = nextKV;
      kA = nextKA;
    }

    double nextCancoderMagnetOffset =
        getSubsystemVariable("Cancoder/MagnetOffset", cancoderMagnetOffsetRotations);
    double nextCancoderDiscontinuityPoint =
        getSubsystemVariable("Cancoder/DiscontinuityPoint", cancoderDiscontinuityPointRotations);
    if (changed(nextCancoderMagnetOffset, cancoderMagnetOffsetRotations)
        || changed(nextCancoderDiscontinuityPoint, cancoderDiscontinuityPointRotations)) {
      applyCancoderConfig(cancoder, nextCancoderMagnetOffset, nextCancoderDiscontinuityPoint);
      cancoderMagnetOffsetRotations = nextCancoderMagnetOffset;
      cancoderDiscontinuityPointRotations = nextCancoderDiscontinuityPoint;
    }

    boolean nextFocEnabled = getSubsystemVariable("Control/FOCEnabled", focEnabled);
    if (nextFocEnabled != focEnabled) {
      focEnabled = nextFocEnabled;
    }

    double nextSensorToMechanismRatio =
        getSubsystemVariable("Ratios/SensorToMechanism", sensorToMechanismRatio);
    double nextRotorToSensorRatio = getSubsystemVariable("Ratios/RotorToSensor", rotorToSensorRatio);
    if (changed(nextSensorToMechanismRatio, sensorToMechanismRatio)
        || changed(nextRotorToSensorRatio, rotorToSensorRatio)) {
      applyFeedbackRatios(positionMotor, cancoderId, nextSensorToMechanismRatio, nextRotorToSensorRatio);
      sensorToMechanismRatio = nextSensorToMechanismRatio;
      rotorToSensorRatio = nextRotorToSensorRatio;
    }

    double nextCruiseVelocity =
        getSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    double nextAcceleration = getSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
    if (changed(nextCruiseVelocity, motionMagicCruiseVelocity)
        || changed(nextAcceleration, motionMagicAcceleration)) {
      MotionMagicConfigs motionMagicConfigs = new MotionMagicConfigs();
      motionMagicConfigs.withMotionMagicCruiseVelocity(nextCruiseVelocity);
      motionMagicConfigs.withMotionMagicAcceleration(nextAcceleration);
      positionMotor.getConfigurator().apply(motionMagicConfigs);
      motionMagicCruiseVelocity = nextCruiseVelocity;
      motionMagicAcceleration = nextAcceleration;
    }

    double nextDefaultPosition = getSubsystemVariable("Position/Default", defaultPosition);
    if (changed(nextDefaultPosition, defaultPosition)) {
      defaultPosition = nextDefaultPosition;
    }
  }

  private static boolean changed(double left, double right) {
    return Math.abs(left - right) > 1.0e-9;
  }

  private static void applyFeedbackRatios(
      TalonFX motor, int cancoderId, double sensorToMechanismRatio, double rotorToSensorRatio) {
    FeedbackConfigs feedbackConfigs = new FeedbackConfigs();
    feedbackConfigs.FeedbackRemoteSensorID = cancoderId;
    feedbackConfigs.FeedbackSensorSource = FeedbackSensorSourceValue.FusedCANcoder;
    feedbackConfigs.SensorToMechanismRatio = sensorToMechanismRatio;
    feedbackConfigs.RotorToSensorRatio = rotorToSensorRatio;
    motor.getConfigurator().apply(feedbackConfigs);
  }

  private static void applyCancoderConfig(
      CANcoder cancoder, double magnetOffsetRotations, double discontinuityPointRotations) {
    CANcoderConfiguration encoderConfig = new CANcoderConfiguration();
    encoderConfig.MagnetSensor.withAbsoluteSensorDiscontinuityPoint(
        Rotations.of(discontinuityPointRotations));
    encoderConfig.MagnetSensor.SensorDirection = SensorDirectionValue.Clockwise_Positive;
    encoderConfig.MagnetSensor.withMagnetOffset(Rotations.of(magnetOffsetRotations));
    cancoder.getConfigurator().apply(encoderConfig);
  }

  /**
   * Sets position setpoint in rotations using Motion Magic. Override or use directly after {@link
   * #positionMotor} is set.
   */
  public void setPositionRotations(double rotations) {
    setpointRotations = rotations;
    io.setPositionRotations(rotations);
  }

  /** Returns the current position setpoint in rotations. */
  public double getSetpointRotations() {
    return setpointRotations;
  }

  /**
   * Sets position setpoint in degrees (converted to rotations). Override or use directly after
   * {@link #positionMotor} is set.
   */
  public void setPositionDegrees(double degrees) {
    setPositionRotations(degrees / 360.0);
  }

  /** Stops the position motor (zero demand). */
  public void stopPosition() {
    io.stop();
  }

  /** Applies the given voltage to the position motor (leader only; followers follow). */
  public void setVoltage(double volts) {
    io.setVoltage(volts);
  }

  /** Returns position in rotations from the primary position motor (if initialized). */
  public double getPositionRotations() {
    return positionMotor != null ? positionMotor.getPosition().getValueAsDouble() : 0;
  }

  /** Returns position in degrees from the primary position motor (if initialized). */
  public double getPositionDegrees() {
    return getPositionRotations() * 360.0;
  }

  /** Returns the primary position motor (if initialized). */
  public TalonFX getPositionMotor() {
    return positionMotor;
  }

  public boolean isFocEnabled() {
    return focEnabled;
  }
}


