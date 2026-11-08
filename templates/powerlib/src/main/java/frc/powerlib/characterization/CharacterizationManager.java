package frc.powerlib.characterization;

import static edu.wpi.first.units.Units.Seconds;
import static edu.wpi.first.units.Units.Volts;
import com.ctre.phoenix6.hardware.CANcoder;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.swerve.SwerveDrivetrain;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotBase;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj.simulation.DriverStationSim;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.Subsystem;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import edu.wpi.first.wpilibj2.command.sysid.SysIdRoutine;
import frc.powerlib.subsystems.VelocitySubsystem;
import frc.powerlib.subsystems.VelocityTorqueSubsystem;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Test-mode-only, leased SysId runner. Physical enable always remains with the FRC DS. */
public final class CharacterizationManager extends SubsystemBase {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static CharacterizationManager instance;
  private final NetworkTable table = NetworkTableInstance.getDefault().getTable("PowerLib/Characterization");
  private final Map<String, CharacterizationTarget> targets = new LinkedHashMap<>();
  private final Map<Subsystem, Runnable> neutral = new LinkedHashMap<>();
  private String lastRequest = "", lastControl = "", id = "", target = "", phase = "", state = "idle", error = "", file = "";
  private double heartbeatTime, nextPublish;
  private long heartbeatChange;
  private TestCommand active;
  private final boolean simulationControl;
  public CharacterizationManager() { this(usesSimulationControl(RobotBase.isSimulation(), System.getenv("HALSIM_EXTENSIONS"))); }
  CharacterizationManager(boolean simulationControl) {
    this.simulationControl = RobotBase.isSimulation() && simulationControl;
    instance = this; table.getEntry("request").setString(""); table.getEntry("simulationControl").setString("");
  }
  static boolean usesSimulationControl(boolean simulation, String extensions) {
    return simulation && (extensions == null || !extensions.toLowerCase(java.util.Locale.ROOT).contains("halsim_ds_socket"));
  }
  public static boolean isActive() { return instance != null && instance.active != null; }
  public void registerNeutral(Subsystem owner, Runnable stop) { neutral.put(owner, stop); }
  public void registerVelocity(String id, String name, VelocitySubsystem subsystem) {
    targets.put(id, new CharacterizationTarget(id, id, name,
        subsystem instanceof VelocityTorqueSubsystem ? "velocityTorque" : "velocity", subsystem,
        subsystem::setVoltage, () -> subsystem.setVoltage(0), List.of(new CharacterizationTarget.Motor(name,
            () -> subsystem.inputs.appliedVoltage, () -> subsystem.inputs.positionRotations,
            () -> subsystem.inputs.velocityRotationsPerSecond, () -> subsystem.inputs.torqueCurrentAmps))));
  }
  public void registerSwerve(String id, String name,
      SwerveDrivetrain<TalonFX, TalonFX, CANcoder> drivetrain, Subsystem owner) {
    var drive = new SwerveRequest.SysIdSwerveTranslation();
    var steer = new SwerveRequest.SysIdSwerveSteerGains();
    var driveMotors = new ArrayList<CharacterizationTarget.Motor>();
    var steerMotors = new ArrayList<CharacterizationTarget.Motor>();
    for (int i = 0; i < drivetrain.getModules().length; i++) {
      driveMotors.add(motor("Module " + (i + 1), drivetrain.getModule(i).getDriveMotor()));
      steerMotors.add(motor("Module " + (i + 1), drivetrain.getModule(i).getSteerMotor()));
    }
    Runnable stop = () -> drivetrain.setControl(new SwerveRequest.Idle());
    targets.put(id + "-drive", new CharacterizationTarget(id + "-drive", id, name + " drive", "drive", owner,
        voltage -> drivetrain.setControl(drive.withVolts(voltage)), stop, driveMotors));
    targets.put(id + "-steer", new CharacterizationTarget(id + "-steer", id, name + " steering", "steer", owner,
        voltage -> drivetrain.setControl(steer.withVolts(voltage)), stop, steerMotors));
  }
  private static CharacterizationTarget.Motor motor(String name, TalonFX motor) {
    return new CharacterizationTarget.Motor(name, () -> motor.getMotorVoltage().getValueAsDouble(),
        () -> motor.getPosition().getValueAsDouble(), () -> motor.getVelocity().getValueAsDouble(),
        () -> motor.getTorqueCurrent().getValueAsDouble());
  }
  private void stopAll() { neutral.values().forEach(Runnable::run); targets.values().forEach(value -> value.stop().run()); }
  private void status(String value, String message) { state = value; error = message; publish(); }
  private void publish() {
    try {
      var catalog = targets.values().stream().map(value -> Map.of("id", value.id(), "group", value.group(),
          "name", value.name(), "kind", value.kind(), "motors", value.motors().stream().map(CharacterizationTarget.Motor::name).toList())).toList();
      table.getEntry("catalog").setString(JSON.writeValueAsString(catalog));
      table.getEntry("status").setString(JSON.writeValueAsString(Map.ofEntries(
          Map.entry("version", 1), Map.entry("timestamp", Timer.getFPGATimestamp()),
          Map.entry("id", id), Map.entry("target", target), Map.entry("phase", phase),
          Map.entry("state", state), Map.entry("error", error), Map.entry("file", file),
          Map.entry("simulation", RobotBase.isSimulation()), Map.entry("controlMode", simulationControl ? "simulation" : "driver-station"),
          Map.entry("enabled", DriverStation.isEnabled()),
          Map.entry("test", DriverStation.isTest()), Map.entry("fms", DriverStation.isFMSAttached()),
          Map.entry("estop", DriverStation.isEStopped()), Map.entry("dsAttached", DriverStation.isDSAttached()),
          Map.entry("commandScheduled", active != null && active.isScheduled()),
          Map.entry("commandStarted", active != null && active.started),
          Map.entry("commandEnded", active != null && active.ended), Map.entry("lastControl", lastControl),
          Map.entry("heartbeatAge", Math.max(0, Timer.getFPGATimestamp() - heartbeatTime)))));
    } catch (Exception exception) { DriverStation.reportError(exception.getMessage(), false); }
  }
  @Override public void periodic() {
    boolean enabledAtStart = DriverStation.isEnabled();
    double now = Timer.getFPGATimestamp();
    String request = table.getEntry("request").getString("");
    if (!request.isEmpty() && !request.equals(lastRequest)) { lastRequest = request; prepare(request); }
    long change = table.getEntry("heartbeat").getLastChange();
    if (change != heartbeatChange) { heartbeatChange = change; heartbeatTime = now; }
    String control = table.getEntry("simulationControl").getString("");
    if (!control.isEmpty() && !control.equals(lastControl)) {
      lastControl = control;
      if (simulationControl) {
        String[] parts = control.split("\\|", -1);
        if (parts.length == 3 && parts[0].equals(id)) {
          DriverStationSim.setDsAttached(true); DriverStationSim.setAutonomous(false); DriverStationSim.setTest(true);
          DriverStationSim.setEnabled(parts[1].equals("enable")); DriverStationSim.notifyNewData();
        }
      }
    }
    if (active != null && (now - heartbeatTime > 1.5 || DriverStation.isFMSAttached() || DriverStation.isEStopped())) {
      active.abort("Characterization stopped: connection lease expired, FMS attached or E-stop.");
    }
    if (active != null) {
      frc.powerlib.PowerRobotContainer.setTuningEnabled(false);
      NetworkTableInstance.getDefault().getTable("PowerLib/Tuning").getEntry("RequestedEnabled").setBoolean(false);
    }
    // Robot.testInit() normally cancels all commands. Acquire requirements only after
    // that transition, during robotPeriodic, rather than scheduling while disabled.
    if (active != null && !active.isScheduled()) {
      stopAll();
      if (active.ended && DriverStation.isDisabled()) active = null;
      else if (enabledAtStart) CommandScheduler.getInstance().schedule(active);
    }
    if (now >= nextPublish) { nextPublish = now + .1; publish(); }
  }
  private void prepare(String request) {
    try {
      var data = JSON.readTree(request);
      String nextId = data.path("id").asText();
      if (!nextId.matches("[a-zA-Z0-9-]{1,90}")) throw new IllegalArgumentException("Invalid test identifier.");
      if (data.path("cancel").asBoolean()) { if (active != null && nextId.equals(id)) active.abort("Cancelled by operator."); return; }
      if (!DriverStation.isDisabled() || DriverStation.isFMSAttached() || DriverStation.isEStopped()) throw new IllegalStateException("Start disabled, outside FMS, with E-stop cleared by the operator.");
      if (active != null) throw new IllegalStateException("Previous test has not released its outputs yet.");
      id = nextId; target = data.path("target").asText(); phase = data.path("phase").asText(); file = "";
      var selected = targets.get(target);
      if (selected == null || !List.of("quasistatic-forward", "quasistatic-reverse", "dynamic-forward", "dynamic-reverse").contains(phase)) throw new IllegalArgumentException("Unknown characterization target or test.");
      double duration = data.path("duration").asDouble(), ramp = data.path("ramp").asDouble(), step = data.path("step").asDouble();
      if (!Double.isFinite(duration + ramp + step) || duration < .5 || duration > 10 || ramp < .1 || ramp > 2 || step < .1 || step > 6) throw new IllegalArgumentException("Test limits are out of range.");
      stopAll(); frc.powerlib.PowerRobotContainer.setTuningEnabled(false); heartbeatTime = Timer.getFPGATimestamp();
      active = new TestCommand(selected, duration, ramp, step);
      status("prepared", "");
    } catch (Exception exception) { if (active != null) active.abort(exception.getMessage()); stopAll(); status("failed", exception.getMessage()); }
  }
  private final class TestCommand extends Command {
    private final CharacterizationTarget selected;
    private final Command routine;
    private CharacterizationRecorder recorder;
    private boolean started, ended, finished;
    TestCommand(CharacterizationTarget selected, double duration, double ramp, double step) {
      this.selected = selected;
      addRequirements(java.util.stream.Stream.concat(targets.values().stream().map(CharacterizationTarget::owner), neutral.keySet().stream()).distinct().toArray(Subsystem[]::new));
      var sysid = new SysIdRoutine(new SysIdRoutine.Config(Volts.of(ramp).per(Seconds), Volts.of(step), Seconds.of(duration), ignored -> {}),
          new SysIdRoutine.Mechanism(voltage -> selected.voltage().accept(Math.copySign(Math.min(step, Math.abs(voltage.in(Volts))), voltage.in(Volts))), ignored -> {}, selected.owner()));
      var direction = phase.endsWith("reverse") ? SysIdRoutine.Direction.kReverse : SysIdRoutine.Direction.kForward;
      routine = phase.startsWith("quasistatic") ? sysid.quasistatic(direction) : sysid.dynamic(direction);
    }
    @Override public boolean runsWhenDisabled() { return true; }
    @Override public void execute() {
      if (ended) { stopAll(); if (DriverStation.isDisabled()) finished = true; return; }
      if (started && !DriverStation.isEnabled()) { abort("Robot disabled during the test; sequence cancelled."); return; }
      if (!DriverStation.isEnabled()) { stopAll(); return; }
      if (!DriverStation.isTest()) { abort("Characterization requires Driver Station Test mode."); return; }
      try {
        if (!started) { recorder = new CharacterizationRecorder(id, selected.motors()); file = recorder.file; routine.initialize(); started = true; status("running", ""); }
        routine.execute(); recorder.sample((long)(Timer.getFPGATimestamp() * 1e6));
        if (routine.isFinished()) { finish(false); status("complete", ""); }
      } catch (Exception exception) { abort(exception.getMessage()); }
    }
    private void finish(boolean interrupted) {
      if (ended) return;
      ended = true;
      try { if (started) routine.end(interrupted); }
      finally { stopAll(); if (recorder != null) { recorder.close(); recorder = null; } }
    }
    void abort(String message) { finish(true); status("cancelled", message);
      if (simulationControl) { DriverStationSim.setEnabled(false); DriverStationSim.notifyNewData(); }
      finished = DriverStation.isDisabled(); }
    @Override public boolean isFinished() { return finished; }
    @Override public void end(boolean interrupted) { if (!ended) { finish(true); status("cancelled", "Test interrupted."); } if (active == this) active = null; }
  }
}
