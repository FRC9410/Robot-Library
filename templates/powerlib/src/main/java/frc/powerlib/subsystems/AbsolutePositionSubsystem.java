package frc.powerlib.subsystems;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.configs.MotionMagicConfigs;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.hardware.TalonFX;
import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.PowerRobotContainer;
import frc.powerlib.configs.AbsolutePositionSubsystemConfig;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.subsystems.io.AbsolutePositionSubsystemIO;
import frc.powerlib.subsystems.io.AbsolutePositionSubsystemIOReal;
import frc.powerlib.subsystems.io.AbsolutePositionSubsystemIOSim;

public class AbsolutePositionSubsystem extends PowerSubsystem {
  private enum MotionProfile {
    NORMAL,
    SLOW
  }

  protected TalonFX positionMotor;
  public final AbsolutePositionSubsystemIO.Inputs inputs = new AbsolutePositionSubsystemIO.Inputs();
  private final AbsolutePositionSubsystemIO io;
  private final AbsolutePositionSubsystemConfig config;
  private MotionProfile activeProfile = null;
  private double setpoint;
  private double voltage;

  public AbsolutePositionSubsystem(AbsolutePositionSubsystemConfig config) {
    this(config, null);
  }

  public AbsolutePositionSubsystem(
      AbsolutePositionSubsystemConfig config, AbsolutePositionSubsystemIO io) {
    super(config.motorConfigs(), config.subsystemName());
    this.config = config;
    this.setpoint = config.homePosition();
    this.voltage = config.stopVoltage();

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

  protected AbsolutePositionSubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? new AbsolutePositionSubsystemIOSim() : new AbsolutePositionSubsystemIOReal(this);
  }

  @Override
  public void periodic() {
    io.updateInputs(inputs);
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

    MotionMagicConfig selectedConfig =
        profile == MotionProfile.SLOW ? config.slowMotionMagicConfig() : config.motionMagicConfig();
    positionMotor.getConfigurator().apply(toMotionMagicConfigs(selectedConfig));
    activeProfile = profile;
  }

  private void publishData() {
    double position = getCurrentPosition();
    boolean connected = inputs.connected;
    boolean atTarget = atTargetPosition();

    SignalLogger.writeDouble(config.subsystemName() + " Position", position, config.units());
    SignalLogger.writeDouble(config.subsystemName() + " Setpoint", setpoint, config.units());
    SignalLogger.writeBoolean(config.subsystemName() + " At Target", atTarget);

    PowerRobotContainer.setData(config.subsystemName() + "/Position", position);
    PowerRobotContainer.setData(config.subsystemName() + "/Setpoint", setpoint);
    PowerRobotContainer.setData(config.subsystemName() + "/AppliedVolts", voltage);
    PowerRobotContainer.setData(config.subsystemName() + "/AtTarget", atTarget);
    PowerRobotContainer.setData(config.subsystemName() + "/Connected", connected);
  }

  private static void configureMotor(
      TalonFX motor, AbsolutePositionSubsystemConfig subsystemConfig) {
    TalonFXConfiguration talonConfig = new TalonFXConfiguration();
    LeadMotorConfig leadConfig = subsystemConfig.leadConfig();

    talonConfig.Slot0.kP = leadConfig.kP();
    talonConfig.Slot0.kI = leadConfig.kI();
    talonConfig.Slot0.kD = leadConfig.kD();
    talonConfig.Slot0.kG = leadConfig.kG();
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

  private static MotionMagicConfigs toMotionMagicConfigs(MotionMagicConfig config) {
    return new MotionMagicConfigs()
        .withMotionMagicCruiseVelocity(config.cruiseVelocity())
        .withMotionMagicAcceleration(config.acceleration());
  }
}
