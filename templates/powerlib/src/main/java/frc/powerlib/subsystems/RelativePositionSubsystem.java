package frc.powerlib.subsystems;

import com.ctre.phoenix6.configs.FeedbackConfigs;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.Slot0Configs;
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
  private MotionProfile requestedProfile = MotionProfile.NORMAL;
  private boolean profilePending;
  private boolean positionPending;
  private boolean holdingPosition;
  private double activatedSetpoint = Double.NaN;
  private enum ControlMode { NONE, POSITION, VOLTAGE }
  private ControlMode controlMode = ControlMode.NONE;
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
    super(config.motorConfigs(), config.subsystemName(), motor -> MotorConfiguration.relative(motor, config),
        io == null && !RobotBase.isSimulation());
    this.config = config;
    this.setpoint = config.homePosition();
    this.voltage = config.stopVoltage();
    this.focEnabled = config.leadConfig().focEnabled();
    initializeTunableState(
        config.leadConfig(), config.motionMagicConfig(), config.slowMotionMagicConfig());

    TalonFX leader = getLeaderMotor();
    if (leader != null) {
      this.positionMotor = leader;
      activeProfile = MotionProfile.NORMAL;
    }
    this.io = io == null ? createDefaultIO() : io;
    this.io.zeroEncoder(config.homePosition());
    inputs.position = config.homePosition();
    setPosition(setpoint);
  }

  protected RelativePositionSubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? new RelativePositionSubsystemIOSim(config) : new RelativePositionSubsystemIOReal(this);
  }

  @Override
  public void periodic() {
    io.updateInputs(inputs);
    if (shouldSyncTuning()) {
      applyMotorTunableValues();
      applyTunableValues();
    }
    activatePositionIfReady();
    publishData();
  }

  public void setPosition(double position) {
    if (!isConfigured()) return;
    if (controlMode != ControlMode.POSITION || position != setpoint) {
      requestedProfile = position <= getCurrentPosition() ? MotionProfile.SLOW : MotionProfile.NORMAL;
      setpoint = position;
      controlMode = ControlMode.POSITION;
      positionPending = true;
      activatePositionIfReady();
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

  /** The last position sent to IO, which can be a hold while the requested target is pending. */
  public double getActivatedSetpoint() {
    return activatedSetpoint;
  }

  public boolean atTargetPosition() {
    return isConfigured() && controlMode == ControlMode.POSITION
        && !positionPending && isAtPosition(setpoint);
  }

  public boolean isAtPosition(double position) {
    return Math.abs(getCurrentPosition() - position) < config.tolerance();
  }

  public void setVoltage(double voltage) {
    if (!isConfigured()) return;
    if (controlMode != ControlMode.VOLTAGE || voltage != this.voltage) {
      this.voltage = voltage;
      io.setVoltage(voltage);
      controlMode = ControlMode.VOLTAGE;
      cancelPendingPosition();
    }
  }

  public void zeroEncoder() {
    zeroEncoder(0.0);
  }

  /** Stop open-loop output and allow a subsequent identical target to resume control. */
  public void stop() {
    io.stop(isConfigured() ? config.stopVoltage() : 0.0);
    controlMode = ControlMode.NONE;
    cancelPendingPosition();
  }

  @Override
  public void setOutput(int canId, double output) {
    super.setOutput(canId, output);
    controlMode = ControlMode.NONE;
    cancelPendingPosition();
  }

  @Override
  public void stopAll() {
    super.stopAll();
    io.setVoltage(0.0);
    controlMode = ControlMode.NONE;
    cancelPendingPosition();
  }

  public void zeroEncoder(double position) {
    // Cancel the old demand before changing the coordinate system.
    io.stop(isConfigured() ? config.stopVoltage() : 0.0);
    io.zeroEncoder(position);
    inputs.position = position;
    controlMode = ControlMode.NONE;
    cancelPendingPosition();
  }

  public boolean isReady() {
    return atTargetPosition() && setpoint == config.homePosition();
  }

  public TalonFX getPositionMotor() {
    return positionMotor;
  }

  public boolean isFocEnabled() {
    return focEnabled;
  }

  private void cancelPendingPosition() {
    positionPending = false;
    holdingPosition = false;
  }

  private void activatePositionIfReady() {
    if (controlMode != ControlMode.POSITION || !isConfigured()) return;
    if (ensureMotionProfile(requestedProfile)) {
      if (positionPending) {
        io.setPosition(setpoint);
        activatedSetpoint = setpoint;
        positionPending = false;
      }
      holdingPosition = false;
    } else {
      positionPending = true;
      if (!holdingPosition) {
        // Keep closed-loop support while configuration is pending, without advancing to the new target.
        activatedSetpoint = getCurrentPosition();
        io.setPosition(activatedSetpoint);
        holdingPosition = true;
      }
    }
  }

  private boolean ensureMotionProfile(MotionProfile profile) {
    if (activeProfile == profile && !profilePending
        && (positionMotor == null || !pendingConfiguration(positionMotor, MotionMagicConfigs.class))) {
      return true;
    }
    profilePending = !configureMotionProfile(
        profile == MotionProfile.SLOW ? slowMotionMagicCruiseVelocity : motionMagicCruiseVelocity,
        profile == MotionProfile.SLOW ? slowMotionMagicAcceleration : motionMagicAcceleration);
    if (!profilePending) {
      activeProfile = profile;
    }
    return !profilePending;
  }

  /**
   * Returns true only after configuration succeeds. Custom IO implementations may override;
   * this hook is also called while constructing the subsystem.
   */
  protected boolean configureMotionProfile(double cruiseVelocity, double acceleration) {
    return positionMotor == null || applyRuntimeConfiguration(positionMotor,
        toMotionMagicConfigs(cruiseVelocity, acceleration));
  }

  private void publishData() {
    double position = getCurrentPosition();
    boolean atTarget = atTargetPosition();

    setSubsystemData("Position", position, config.units());
    setSubsystemData("Setpoint", setpoint, config.units());
    setSubsystemData("AtTarget", atTarget);
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
    if (!frc.powerlib.PowerRobotContainer.isTuningEnabled() || positionMotor == null) {
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
        || changed(nextKA, kA) || pendingConfiguration(positionMotor, Slot0Configs.class)) {
      Slot0Configs slot0 = MotorConfiguration.slot0(nextKP, nextKI, nextKD, nextKG, nextKS, nextKV, nextKA);
      if (applyRuntimeConfiguration(positionMotor, slot0)) {
        kP = nextKP;
        kI = nextKI;
        kD = nextKD;
        kG = nextKG;
        kS = nextKS;
        kV = nextKV;
        kA = nextKA;
      }
    }

    boolean nextFocEnabled = getSubsystemVariable("Control/FOCEnabled", focEnabled);
    if (nextFocEnabled != focEnabled) {
      focEnabled = nextFocEnabled;
      if (controlMode == ControlMode.POSITION) positionPending = true;
    }

    double nextSensorToMechanismRatio =
        getFeedbackRatioSubsystemVariable("Ratios/SensorToMechanism", sensorToMechanismRatio);
    double nextRotorToSensorRatio = getFeedbackRatioSubsystemVariable("Ratios/RotorToSensor", rotorToSensorRatio);
    if (changed(nextSensorToMechanismRatio, sensorToMechanismRatio)
        || changed(nextRotorToSensorRatio, rotorToSensorRatio) || pendingConfiguration(positionMotor, FeedbackConfigs.class)) {
      if (applyFeedbackRatios(positionMotor, nextSensorToMechanismRatio, nextRotorToSensorRatio)) {
        sensorToMechanismRatio = nextSensorToMechanismRatio;
        rotorToSensorRatio = nextRotorToSensorRatio;
      }
    }

    double nextCruiseVelocity =
        getNonnegativeSubsystemVariable("MotionMagic/CruiseVelocity", motionMagicCruiseVelocity);
    double nextAcceleration = getNonnegativeSubsystemVariable("MotionMagic/Acceleration", motionMagicAcceleration);
    double nextSlowCruiseVelocity =
        getNonnegativeSubsystemVariable("SlowMotionMagic/CruiseVelocity", slowMotionMagicCruiseVelocity);
    double nextSlowAcceleration =
        getNonnegativeSubsystemVariable("SlowMotionMagic/Acceleration", slowMotionMagicAcceleration);

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

  private boolean applyFeedbackRatios(
      TalonFX motor, double sensorToMechanismRatio, double rotorToSensorRatio) {
    FeedbackConfigs feedbackConfigs = new FeedbackConfigs();
    feedbackConfigs.SensorToMechanismRatio = sensorToMechanismRatio;
    feedbackConfigs.RotorToSensorRatio = rotorToSensorRatio;
    return applyRuntimeConfiguration(motor, feedbackConfigs);
  }
}
