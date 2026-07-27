package frc.powerlib.subsystems;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.configs.FeedbackConfigs;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.Slot0Configs;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.hardware.TalonFX;
import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.configs.RelativePositionSubsystemConfig;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.subsystems.io.RelativePositionSubsystemIO;
import frc.powerlib.subsystems.io.RelativePositionSubsystemIOReal;
import frc.powerlib.subsystems.io.RelativePositionSubsystemIOSim;

public class RelativePositionSubsystem extends PowerSubsystem {
  private enum MotionProfile {
    NORMAL,
    SLOW
  }

  protected TalonFX positionMotor;
  public final RelativePositionSubsystemIO.Inputs inputs = new RelativePositionSubsystemIO.Inputs();
  private final RelativePositionSubsystemIO io;
  private final RelativePositionSubsystemConfig config;
  private MotionProfile activeProfile = null;
  private double setpoint;
  private double voltage;
  private boolean focEnabled;
  private double kP;
  private double kI;
  private double kD;
  private double kG;
  private double kS;
  private double kV;
  private double kA;
  private double sensorToMechanismRatio;
  private double rotorToSensorRatio;
  private double motionMagicCruiseVelocity;
  private double motionMagicAcceleration;
  private double slowMotionMagicCruiseVelocity;
  private double slowMotionMagicAcceleration;

  public RelativePositionSubsystem(RelativePositionSubsystemConfig config) {
    this(config, null);
  }

  public RelativePositionSubsystem(
      RelativePositionSubsystemConfig config, RelativePositionSubsystemIO io) {
    super(config.motorConfigs(), config.subsystemName());
    this.config = config;
    this.setpoint = config.homePosition();
    this.voltage = config.stopVoltage();
    this.focEnabled = config.leadConfig().focEnabled();
    initializeTunableState(
        config.leadConfig(), config.motionMagicConfig(), config.slowMotionMagicConfig());

    TalonFX leader = getLeaderMotor();
    if (leader != null) {
      configureMotor(leader, config);
      this.positionMotor = leader;
      applyMotionProfile(MotionProfile.NORMAL);
    }
    this.io = io == null ? createDefaultIO() : io;
    zeroEncoder(config.homePosition());
    this.io.setPosition(setpoint);
  }

  protected RelativePositionSubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? new RelativePositionSubsystemIOSim() : new RelativePositionSubsystemIOReal(this);
  }

  @Override
  public void periodic() {
    io.updateInputs(inputs);
    applyMotorTunableValues();
    applyTunableValues();
    applyProfileForSetpoint();
    publishData();
  }

  public void setPosition(double position) {
    if (position != setpoint) {
      setpoint = position;
      io.setPosition(position);
    }
  }

  public void setPositionRotations(double rotations) {
    setPosition(rotations);
  }

  public double getCurrentPosition() {
    return inputs.position;
  }

  public double getSetpoint() {
    return setpoint;
  }

  public boolean atTargetPosition() {
    return isAtPosition(setpoint);
  }

  public boolean isAtPosition(double position) {
    return Math.abs(getCurrentPosition() - position) < config.tolerance();
  }

  public void setVoltage(double voltage) {
    if (voltage != this.voltage) {
      this.voltage = voltage;
      io.setVoltage(voltage);
    }
  }

  public void zeroEncoder() {
    zeroEncoder(0.0);
  }

  public void zeroEncoder(double position) {
    io.zeroEncoder(position);
  }

  public boolean isReady() {
    return isAtPosition(config.homePosition()) && setpoint == config.homePosition();
  }

  public TalonFX getPositionMotor() {
    return positionMotor;
  }

  public boolean isFocEnabled() {
    return focEnabled;
  }

  private void applyProfileForSetpoint() {
    if (positionMotor == null) {
      return;
    }

    if (setpoint <= getCurrentPosition()) {
      applyMotionProfile(MotionProfile.SLOW);
      return;
    }

    applyMotionProfile(MotionProfile.NORMAL);
  }

  private void applyMotionProfile(MotionProfile profile) {
    if (positionMotor == null || activeProfile == profile) {
      return;
    }

    positionMotor.getConfigurator().apply(
        profile == MotionProfile.SLOW
            ? toMotionMagicConfigs(slowMotionMagicCruiseVelocity, slowMotionMagicAcceleration)
            : toMotionMagicConfigs(motionMagicCruiseVelocity, motionMagicAcceleration));
    activeProfile = profile;
  }

  private void publishData() {
    double position = getCurrentPosition();
    boolean connected = inputs.connected;
    boolean atTarget = atTargetPosition();

    SignalLogger.writeDouble(config.subsystemName() + " Position", position, config.units());
    SignalLogger.writeDouble(config.subsystemName() + " Setpoint", setpoint, config.units());
    SignalLogger.writeBoolean(config.subsystemName() + " At Target", atTarget);

    setSubsystemData("Position", position);
    setSubsystemData("Setpoint", setpoint);
    setSubsystemData("AppliedVolts", voltage);
    setSubsystemData("AtTarget", atTarget);
    setSubsystemData("Connected", connected);
  }

  private static void configureMotor(
      TalonFX motor, RelativePositionSubsystemConfig subsystemConfig) {
    TalonFXConfiguration talonConfig = new TalonFXConfiguration();
    LeadMotorConfig leadConfig = subsystemConfig.leadConfig();

    talonConfig.Slot0.kP = leadConfig.kP();
    talonConfig.Slot0.kI = leadConfig.kI();
    talonConfig.Slot0.kD = leadConfig.kD();
    talonConfig.Slot0.kG = leadConfig.kG();
    talonConfig.Feedback.SensorToMechanismRatio = leadConfig.sensorToMechanismRatio();
    talonConfig.Feedback.RotorToSensorRatio = leadConfig.rotorToSensorRatio();
    if (leadConfig.kS().isPresent()) {
      talonConfig.Slot0.kS = leadConfig.kS().get();
      talonConfig.Slot0.kV = leadConfig.kV().get();
      talonConfig.Slot0.kA = leadConfig.kA().get();
    }

    talonConfig.SoftwareLimitSwitch.ForwardSoftLimitEnable = true;
    talonConfig.SoftwareLimitSwitch.ForwardSoftLimitThreshold =
        subsystemConfig.forwardSoftLimit();
    talonConfig.SoftwareLimitSwitch.ReverseSoftLimitEnable = true;
    talonConfig.SoftwareLimitSwitch.ReverseSoftLimitThreshold =
        subsystemConfig.reverseSoftLimit();

    motor.getConfigurator().apply(talonConfig);
  }

  private static MotionMagicConfigs toMotionMagicConfigs(double cruiseVelocity, double acceleration) {
    return new MotionMagicConfigs()
        .withMotionMagicCruiseVelocity(cruiseVelocity)
        .withMotionMagicAcceleration(acceleration);
  }

  private void initializeTunableState(
      LeadMotorConfig leadConfig,
      MotionMagicConfig motionMagicConfig,
      MotionMagicConfig slowMotionMagicConfig) {
    kP = leadConfig.kP();
    kI = leadConfig.kI();
    kD = leadConfig.kD();
    kG = leadConfig.kG();
    kS = leadConfig.kS().orElse(0.0);
    kV = leadConfig.kV().orElse(0.0);
    kA = leadConfig.kA().orElse(0.0);
    sensorToMechanismRatio = leadConfig.sensorToMechanismRatio();
    rotorToSensorRatio = leadConfig.rotorToSensorRatio();
    motionMagicCruiseVelocity = motionMagicConfig.cruiseVelocity();
    motionMagicAcceleration = motionMagicConfig.acceleration();
    slowMotionMagicCruiseVelocity = slowMotionMagicConfig.cruiseVelocity();
    slowMotionMagicAcceleration = slowMotionMagicConfig.acceleration();

    registerSubsystemVariable("Control/FOCEnabled", focEnabled);
    registerSubsystemVariable("PID/kP", kP);
    registerSubsystemVariable("PID/kI", kI);
    registerSubsystemVariable("PID/kD", kD);
    registerSubsystemVariable("PID/kG", kG);
    registerSubsystemVariable("Feedforward/kS", kS);
    registerSubsystemVariable("Feedforward/kV", kV);
    registerSubsystemVariable("Feedforward/kA", kA);
    registerSubsystemVariable("Ratios/SensorToMechanism", sensorToMechanismRatio);
    registerSubsystemVariable("Ratios/RotorToSensor", rotorToSensorRatio);
    registerSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    registerSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
    registerSubsystemVariable("SlowMotionMagic/CruiseVelocity", slowMotionMagicCruiseVelocity);
    registerSubsystemVariable("SlowMotionMagic/Acceleration", slowMotionMagicAcceleration);
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

    boolean nextFocEnabled = getSubsystemVariable("Control/FOCEnabled", focEnabled);
    if (nextFocEnabled != focEnabled) {
      focEnabled = nextFocEnabled;
    }

    double nextSensorToMechanismRatio =
        getSubsystemVariable("Ratios/SensorToMechanism", sensorToMechanismRatio);
    double nextRotorToSensorRatio = getSubsystemVariable("Ratios/RotorToSensor", rotorToSensorRatio);
    if (changed(nextSensorToMechanismRatio, sensorToMechanismRatio)
        || changed(nextRotorToSensorRatio, rotorToSensorRatio)) {
      applyFeedbackRatios(positionMotor, nextSensorToMechanismRatio, nextRotorToSensorRatio);
      sensorToMechanismRatio = nextSensorToMechanismRatio;
      rotorToSensorRatio = nextRotorToSensorRatio;
    }

    double nextCruiseVelocity =
        getSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    double nextAcceleration = getSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
    double nextSlowCruiseVelocity =
        getSubsystemVariable("SlowMotionMagic/CruiseVelocity", slowMotionMagicCruiseVelocity);
    double nextSlowAcceleration =
        getSubsystemVariable("SlowMotionMagic/Acceleration", slowMotionMagicAcceleration);

    if (changed(nextCruiseVelocity, motionMagicCruiseVelocity)
        || changed(nextAcceleration, motionMagicAcceleration)
        || changed(nextSlowCruiseVelocity, slowMotionMagicCruiseVelocity)
        || changed(nextSlowAcceleration, slowMotionMagicAcceleration)) {
      motionMagicCruiseVelocity = nextCruiseVelocity;
      motionMagicAcceleration = nextAcceleration;
      slowMotionMagicCruiseVelocity = nextSlowCruiseVelocity;
      slowMotionMagicAcceleration = nextSlowAcceleration;
      activeProfile = null;
    }
  }

  private static boolean changed(double left, double right) {
    return Math.abs(left - right) > 1.0e-9;
  }

  private static void applyFeedbackRatios(
      TalonFX motor, double sensorToMechanismRatio, double rotorToSensorRatio) {
    FeedbackConfigs feedbackConfigs = new FeedbackConfigs();
    feedbackConfigs.SensorToMechanismRatio = sensorToMechanismRatio;
    feedbackConfigs.RotorToSensorRatio = rotorToSensorRatio;
    motor.getConfigurator().apply(feedbackConfigs);
  }
}
