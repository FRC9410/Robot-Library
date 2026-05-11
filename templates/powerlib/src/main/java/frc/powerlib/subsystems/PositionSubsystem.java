// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib.subsystems;

import static edu.wpi.first.units.Units.Rotations;

import com.ctre.phoenix6.BaseStatusSignal;
import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.configs.CANcoderConfiguration;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.controls.MotionMagicVoltage;
import com.ctre.phoenix6.hardware.CANcoder;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.signals.FeedbackSensorSourceValue;
import com.ctre.phoenix6.signals.NeutralModeValue;
import com.ctre.phoenix6.signals.SensorDirectionValue;
import com.ctre.phoenix6.CANBus;
import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.PowerRobotContainer;
import frc.powerlib.configs.CancoderConfig;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.configs.PositionSubsystemConfig;
import frc.powerlib.subsystems.io.PositionSubsystemIO;
import frc.powerlib.subsystems.io.PositionSubsystemIOReal;
import frc.powerlib.subsystems.io.PositionSubsystemIOSim;

import java.util.Optional;

public class PositionSubsystem extends PowerSubsystem {

  private static final String DEFAULT_CAN_BUS_NAME = "canivore";

  /** Primary position-controlled motor (with fused CANcoder from config constructor). */
  protected TalonFX positionMotor;
  public final PositionSubsystemIO.Inputs inputs = new PositionSubsystemIO.Inputs();
  private final PositionSubsystemIO io;
  private String subsystemName;
  private String units;

  /** Last commanded position setpoint in rotations. */
  private double setpointRotations;

  /**
   * Constructor that uses the leader motor from the config and configures it with lead, CANcoder,
   * and motion magic settings from the same config.
   *
   * @param config single config containing motor configs, lead, CANcoder, motion magic, name, and units
   */
  public PositionSubsystem(PositionSubsystemConfig config) {
    this(config, null);
  }

  public PositionSubsystem(PositionSubsystemConfig config, PositionSubsystemIO io) {
    super(config.motorConfigs(), config.subsystemName());
    TalonFX leader = getLeaderMotor();
    if (leader != null) {
      configureMotorWithCancoder(leader, config.leadConfig(), config.cancoderConfig(), config.motionMagicConfig(), config.defaultPosition());
      this.positionMotor = leader;
    }
    this.subsystemName = config.subsystemName();
    this.units = config.units();
    this.setpointRotations = config.defaultPosition().orElseGet(() -> leader != null ? leader.getPosition().getValueAsDouble() : 0.0);
    this.io = io == null ? createDefaultIO() : io;
  }

  private PositionSubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? new PositionSubsystemIOSim() : new PositionSubsystemIOReal(this);
  }

  @Override
  public void periodic() {
    io.updateInputs(inputs);
    SignalLogger.writeDouble(subsystemName + " Position", inputs.positionRotations, units);
    PowerRobotContainer.setData(subsystemName + "/Position", inputs.positionRotations);
    PowerRobotContainer.setData(subsystemName + "/SetpointRotations", inputs.setpointRotations);
    PowerRobotContainer.setData(subsystemName + "/AppliedVolts", inputs.appliedVolts);
    PowerRobotContainer.setData(subsystemName + "/Connected", inputs.connected);
  }

  /**
   * Configures an existing TalonFX with a CANcoder and the given lead, CANcoder, and motion magic
   * configs. Used by the config-list constructor.
   */
  private static void configureMotorWithCancoder(
      TalonFX motor,
      LeadMotorConfig leadConfig,
      CancoderConfig cancoderConfig,
      MotionMagicConfig motionMagicConfig,
      Optional<Double> defaultPos) {
    @SuppressWarnings("resource") // CANcoder is fused to motor, lifecycle tied to subsystem
    CANcoder cancoder =
        new CANcoder(cancoderConfig.encoderId(), new CANBus(DEFAULT_CAN_BUS_NAME));

    CANcoderConfiguration encoderConfig = new CANcoderConfiguration();
    encoderConfig.MagnetSensor.withAbsoluteSensorDiscontinuityPoint(
        Rotations.of(cancoderConfig.discontinuityPointRotations()));
    encoderConfig.MagnetSensor.SensorDirection = SensorDirectionValue.Clockwise_Positive;
    encoderConfig.MagnetSensor.withMagnetOffset(Rotations.of(cancoderConfig.magnetOffsetRotations()));
    cancoder.getConfigurator().apply(encoderConfig);

    TalonFXConfiguration talonConfig = new TalonFXConfiguration();
    talonConfig.Slot0.kP = leadConfig.kP();
    talonConfig.Slot0.kI = leadConfig.kI();
    talonConfig.Slot0.kD = leadConfig.kD();
    talonConfig.Slot0.kG = leadConfig.kG();
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
    motor.setNeutralMode(NeutralModeValue.Brake);

    double targetPos = defaultPos.isEmpty() ?  motor.getPosition().getValueAsDouble() : defaultPos.get();

    motor.setControl(new MotionMagicVoltage(0).withPosition(targetPos).withSlot(0));
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
}


