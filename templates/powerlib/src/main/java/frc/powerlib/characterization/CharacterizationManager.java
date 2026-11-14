package frc.powerlib.characterization;

import static edu.wpi.first.units.Units.Seconds;
import static edu.wpi.first.units.Units.Volts;
import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.hardware.CANcoder;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.swerve.SwerveDrivetrain;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableEntry;
import edu.wpi.first.networktables.NetworkTablesJNI;
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
import frc.powerlib.health.HealthChecks;
import frc.powerlib.subsystems.AbsolutePositionSubsystem;
import frc.powerlib.subsystems.RelativePositionSubsystem;
import frc.powerlib.subsystems.VelocitySubsystem;
import frc.powerlib.subsystems.VelocityTorqueSubsystem;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;

/** Test-mode-only, leased SysId runner. Physical enable always remains with the FRC DS. */
public final class CharacterizationManager extends SubsystemBase {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static CharacterizationManager instance;
  private final NetworkTable table = NetworkTableInstance.getDefault().getTable("PowerLib/Characterization");
  private final Map<String, CharacterizationTarget> targets = new LinkedHashMap<>();
  private final Map<String, PositionCrawl.Target> crawlTargets = new LinkedHashMap<>();
  private final NetworkTableEntry crawlLease = table.getEntry("crawlLease");
  private final NetworkTableEntry crawlNudge = table.getEntry("crawlNudge");
  private final Map<Subsystem, Runnable> neutral = new LinkedHashMap<>();
  private String lastRequest = "", lastControl = "", id = "", target = "", phase = "", state = "idle", error = "", file = "";
  private double heartbeatTime, nextPublish;
  private long heartbeatChange;
  private TestCommand active;
  private final boolean simulationControl;
  private final BiConsumer<String, String> referenceLog;
  public CharacterizationManager() { this(usesSimulationControl(RobotBase.isSimulation(), System.getenv("HALSIM_EXTENSIONS"))); }
  CharacterizationManager(boolean simulationControl) {
    this(simulationControl, (key, value) -> {
      if (RobotBase.isReal()) SignalLogger.writeString(key, value);
    });
  }
  CharacterizationManager(boolean simulationControl, BiConsumer<String, String> referenceLog) {
    this.simulationControl = RobotBase.isSimulation() && simulationControl;
    this.referenceLog = referenceLog;
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
  public void registerPositionCrawl(String id, String name, AbsolutePositionSubsystem subsystem) {
    var target = new PositionCrawl.Target(id, name, subsystem, subsystem::setVoltage,
        subsystem::stopPosition, () -> {
          if (!subsystem.isConfigured()) return null;
          if (RobotBase.isSimulation()) {
            return new PositionCrawl.Feedback(subsystem.getPositionRotations(), subsystem.inputs.velocityRotationsPerSecond);
          }
          return feedback(subsystem.getPositionMotor());
        }, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY);
    registerPosition(target, subsystem::getPositionMotor, () -> subsystem.inputs.appliedVoltage,
        subsystem::getPositionRotations, () -> subsystem.inputs.velocityRotationsPerSecond);
  }

  public void registerPositionCrawl(String id, String name, RelativePositionSubsystem subsystem) {
    var target = new PositionCrawl.Target(id, name, subsystem, subsystem::setVoltage,
        subsystem::stopAll, () -> {
          if (!subsystem.isConfigured()) return null;
          if (RobotBase.isSimulation()) {
            return new PositionCrawl.Feedback(subsystem.getCurrentPosition(), subsystem.inputs.velocityRotationsPerSecond);
          }
          return feedback(subsystem.getPositionMotor());
        }, subsystem.getReverseSoftLimit(), subsystem.getForwardSoftLimit());
    registerPosition(target, subsystem::getPositionMotor, () -> subsystem.inputs.appliedVoltage,
        subsystem::getCurrentPosition, () -> subsystem.inputs.velocityRotationsPerSecond);
  }

  private void registerPosition(PositionCrawl.Target target, Supplier<TalonFX> motor, DoubleSupplier simVoltage,
      DoubleSupplier position, DoubleSupplier velocity) {
    crawlTargets.put(target.id(), target);
    var signal = new CharacterizationTarget.Motor(target.name(), () -> {
      if (RobotBase.isSimulation()) return simVoltage.getAsDouble();
      var voltage = motor.get().getMotorVoltage();
      if (!HealthChecks.signalHealthy(voltage, .10)) throw new IllegalStateException("Fresh motor voltage feedback is required.");
      return voltage.getValueAsDouble();
    }, position, velocity, () -> RobotBase.isSimulation() ? 0 : motor.get().getTorqueCurrent().getValueAsDouble());
    targets.put(target.id(), new CharacterizationTarget(target.id(), target.id(), target.name(), "position",
        target.owner(), target.voltage(), target.stop(), List.of(signal)));
  }

  private static PositionCrawl positionWindow(PositionCrawl.Target target, JsonNode bounds, int polarity) {
    double lower = bounds.path("lower").asDouble(Double.NaN);
    double upper = bounds.path("upper").asDouble(Double.NaN);
    double margin = bounds.path("margin").asDouble(Double.NaN);
    double lowerStop = bounds.has("lowerStop") ? bounds.path("lowerStop").asDouble(Double.NaN) : lower + margin;
    double upperStop = bounds.has("upperStop") ? bounds.path("upperStop").asDouble(Double.NaN) : upper - margin;
    return new PositionCrawl(target, lower, upper, lowerStop, upperStop, polarity);
  }

  private static PositionCrawl.Feedback feedback(TalonFX motor) {
    if (motor == null) return null;
    var position = motor.getPosition();
    var velocity = motor.getVelocity();
    if (!HealthChecks.signalHealthy(position, .10) || !HealthChecks.signalHealthy(velocity, .10)) return null;
    return new PositionCrawl.Feedback(position.getValueAsDouble(), velocity.getValueAsDouble());
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
      var crawlCatalog = crawlTargets.values().stream().map(value -> {
        var details = new LinkedHashMap<String, Object>();
        details.put("id", value.id());
        details.put("name", value.name());
        if (Double.isFinite(value.softMin())) details.put("lower", value.softMin());
        if (Double.isFinite(value.softMax())) details.put("upper", value.softMax());
        return details;
      }).toList();
      table.getEntry("crawlCatalog").setString(JSON.writeValueAsString(crawlCatalog));
      var positions = new LinkedHashMap<String, PositionCrawl.Feedback>();
      crawlTargets.forEach((key, value) -> {
        var reading = value.feedback().get();
        if (reading != null && Double.isFinite(reading.position()) && Double.isFinite(reading.velocity())) {
          positions.put(key, reading);
        }
      });
      table.getEntry("positionFeedback").setString(JSON.writeValueAsString(
          Map.of("timestamp", Timer.getFPGATimestamp(), "positions", positions)));
      table.getEntry("status").setString(JSON.writeValueAsString(Map.ofEntries(
          Map.entry("version", 1), Map.entry("timestamp", Timer.getFPGATimestamp()),
          Map.entry("id", id), Map.entry("target", target), Map.entry("phase", phase),
          Map.entry("state", state), Map.entry("error", error), Map.entry("file", file),
          Map.entry("simulation", RobotBase.isSimulation()), Map.entry("controlMode", simulationControl ? "simulation" : "driver-station"),
          Map.entry("separateRampLimit", true),
          Map.entry("manualDrivetrain", true),
          Map.entry("crawlSpeedCutoff", true),
          Map.entry("positionSysId", true),
          Map.entry("crawlFeedback", active == null || active.crawl == null ? Map.of() : active.crawl.status()),
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
      if (simulationControl && active != null && !active.manualControl) {
        String[] parts = control.split("\\|", -1);
        if (parts.length == 3 && parts[0].equals(id)) {
          DriverStationSim.setDsAttached(true); DriverStationSim.setAutonomous(false); DriverStationSim.setTest(true);
          DriverStationSim.setEnabled(parts[1].equals("enable")); DriverStationSim.notifyNewData();
        }
      }
    }
    if (active != null && !active.ended && ((active.crawl == null ? now - heartbeatTime > 1.5 : !active.crawlLeaseHealthy(now))
        || active.positionGuard != null && !active.started && now - active.armedAt >= 30
        || DriverStation.isFMSAttached() || DriverStation.isEStopped())) {
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
      if (phase.equals("crawl")) {
        var selected = crawlTargets.get(target);
        if (selected == null || (!simulationControl && !DriverStation.isTest())) {
          throw new IllegalArgumentException("Select a position subsystem and start in Driver Station Test mode.");
        }
        var crawl = positionWindow(selected, data, data.path("polarity").asInt(1));
        stopAll();
        frc.powerlib.PowerRobotContainer.setTuningEnabled(false);
        active = new TestCommand(selected, crawl);
        status("prepared", "");
        return;
      }
      var selected = targets.get(target);
      if (selected == null || !List.of("quasistatic-forward", "quasistatic-reverse", "dynamic-forward", "dynamic-reverse").contains(phase)) throw new IllegalArgumentException("Unknown characterization target or test.");
      boolean manualControl = data.path("manualControl").asBoolean(false);
      boolean position = selected.kind().equals("position");
      if (position && !manualControl || manualControl && (!List.of("drive", "steer", "position").contains(selected.kind())
          || (!simulationControl && !DriverStation.isTest()))) {
        throw new IllegalArgumentException("Position tests require manual control. Start manual tests in Driver Station Test mode.");
      }
      PositionCrawl positionGuard = null;
      double maxSpeed = 0;
      int polarity = 1;
      if (position) {
        var bounds = data.path("positionTest");
        maxSpeed = bounds.path("speedLimit").asDouble(Double.NaN);
        polarity = bounds.path("polarity").asInt();
        if (!Double.isFinite(maxSpeed) || maxSpeed <= 0 || (polarity != 1 && polarity != -1)) {
          throw new IllegalArgumentException("Enter a positive speed cutoff and verify the voltage direction.");
        }
        positionGuard = positionWindow(crawlTargets.get(target), bounds, polarity);
        positionGuard.verifySysIdStart(phase.endsWith("reverse") ? -1 : 1);
      }
      double duration = data.path("duration").asDouble(), ramp = data.path("ramp").asDouble(), step = data.path("step").asDouble();
      double rampLimit = data.has("rampLimit") ? data.path("rampLimit").asDouble(Double.NaN) : step;
      if (!Double.isFinite(duration + ramp + step + rampLimit) || duration < .5 || duration > 10
          || ramp < .1 || ramp > 2 || step < .1 || step > 6 || rampLimit < .1 || rampLimit > 6) {
        throw new IllegalArgumentException("Test limits are out of range.");
      }
      stopAll(); frc.powerlib.PowerRobotContainer.setTuningEnabled(false); heartbeatTime = Timer.getFPGATimestamp();
      active = new TestCommand(selected, duration, ramp, step, rampLimit, manualControl, positionGuard, maxSpeed, polarity);
      status("prepared", "");
    } catch (Exception exception) { if (active != null) active.abort(exception.getMessage()); stopAll(); status("failed", exception.getMessage()); }
  }
  private final class TestCommand extends Command {
    private final CharacterizationTarget selected;
    private final Command routine;
    private final boolean manualControl;
    private final PositionCrawl crawl, positionGuard;
    private final double maxSpeed;
    private final int travelDirection = phase.endsWith("reverse") ? -1 : 1;
    private final double armedAt = Timer.getFPGATimestamp();
    private String lastNudge = "";
    private CharacterizationRecorder recorder;
    private boolean started, ended, finished;
    TestCommand(CharacterizationTarget selected, double duration, double ramp, double step, double rampLimit, boolean manualControl,
        PositionCrawl positionGuard, double maxSpeed, int polarity) {
      this.selected = selected;
      this.manualControl = manualControl;
      crawl = null;
      this.positionGuard = positionGuard;
      this.maxSpeed = maxSpeed;
      acquireRequirements();
      boolean quasistatic = phase.startsWith("quasistatic");
      double ceiling = quasistatic ? rampLimit : step;
      var sysid = new SysIdRoutine(new SysIdRoutine.Config(Volts.of(ramp).per(Seconds), Volts.of(step), Seconds.of(duration),
          sysidState -> referenceLog.accept("PowerToolCharacterization/State", sysidState.toString())),
          new SysIdRoutine.Mechanism(voltage -> selected.voltage().accept(polarity * Math.copySign(Math.min(ceiling, Math.abs(voltage.in(Volts))), voltage.in(Volts))), ignored -> {}, selected.owner()));
      var direction = phase.endsWith("reverse") ? SysIdRoutine.Direction.kReverse : SysIdRoutine.Direction.kForward;
      routine = quasistatic ? sysid.quasistatic(direction) : sysid.dynamic(direction);
    }
    TestCommand(PositionCrawl.Target target, PositionCrawl crawl) {
      this.crawl = crawl;
      positionGuard = null;
      maxSpeed = 0;
      selected = null;
      routine = null;
      manualControl = true;
      acquireRequirements();
      addRequirements(target.owner());
    }

    private void acquireRequirements() {
      addRequirements(java.util.stream.Stream.concat(targets.values().stream().map(CharacterizationTarget::owner),
          neutral.keySet().stream()).distinct().toArray(Subsystem[]::new));
    }

    private boolean crawlLeaseHealthy(double now) {
      return (started || now - armedAt < 30) && (now - armedAt < .5 || hasFreshCrawlLease());
    }

    private boolean hasFreshCrawlLease() {
      String lease = crawlLease.getString("");
      double age = (NetworkTablesJNI.now() - crawlLease.getLastChange()) / 1e6;
      return lease.startsWith(id + "|") && age >= 0 && age < .5;
    }

    private void executeCrawl() throws java.io.IOException {
      double now = Timer.getFPGATimestamp();
      if (!started) {
        lastNudge = crawlNudge.getString("");
        crawl.checkFeedback();
        started = true;
        status("ready", "");
      }
      String stopped = crawl.update(now);
      if (stopped != null) status("ready", stopped);
      String request = crawlNudge.getString("");
      if (request.isEmpty() || request.equals(lastNudge)) return;
      lastNudge = request;
      var data = JSON.readTree(request);
      double age = (NetworkTablesJNI.now() - crawlNudge.getLastChange()) / 1e6;
      if (!id.equals(data.path("id").asText()) || age < 0 || age >= .3 || stopped != null
          || !state.equals("ready") || !hasFreshCrawlLease()) return;
      int legacyLevel = data.path("level").asInt();
      double speedLimit = data.has("speedLimit") ? data.path("speedLimit").asDouble(Double.NaN)
          : legacyLevel >= 1 && legacyLevel <= 4 ? legacyLevel * 0.025 : Double.NaN;
      String result = crawl.nudge(data.path("direction").asInt(), speedLimit, now);
      if (result != null) status(result.isEmpty() ? "moving" : "ready", result);
    }

    @Override public InterruptionBehavior getInterruptionBehavior() {
      return crawl == null && positionGuard == null ? InterruptionBehavior.kCancelSelf : InterruptionBehavior.kCancelIncoming;
    }

    @Override public boolean runsWhenDisabled() { return true; }
    @Override public void execute() {
      if (ended) { stopAll(); if (DriverStation.isDisabled()) finished = true; return; }
      if (started && !DriverStation.isEnabled()) { abort("Robot disabled during the test; sequence cancelled."); return; }
      if (!DriverStation.isEnabled()) { stopAll(); return; }
      if (!DriverStation.isTest()) { abort("Characterization requires Driver Station Test mode."); return; }
      try {
        if (crawl != null) { executeCrawl(); return; }
        if (!started) {
          if (positionGuard != null) positionGuard.verifySysIdStart(travelDirection);
          recorder = new CharacterizationRecorder(id, selected.motors());
          file = recorder.file;
          referenceLog.accept("PowerToolCharacterization/TestId", id);
          referenceLog.accept("PowerToolCharacterization/Target", selected.id());
          routine.initialize();
          started = true;
          status("running", "");
        }
        String cutoff = positionGuard == null ? "" : positionGuard.sysIdCutoff(travelDirection, maxSpeed);
        if (cutoff.isEmpty()) routine.execute();
        recorder.sample((long)(Timer.getFPGATimestamp() * 1e6));
        if (!cutoff.isEmpty() || routine.isFinished()) { finish(false); status("complete", cutoff); }
      } catch (Exception exception) { abort(exception.getMessage()); }
    }
    private void finish(boolean interrupted) {
      if (ended) return;
      ended = true;
      try { if (crawl != null) crawl.stop(); else if (started) routine.end(interrupted); }
      finally { stopAll(); if (recorder != null) { recorder.close(); recorder = null; } }
    }
    void abort(String message) { finish(true); status("cancelled", message);
      if (simulationControl && !manualControl) { DriverStationSim.setEnabled(false); DriverStationSim.notifyNewData(); }
      finished = DriverStation.isDisabled(); }
    @Override public boolean isFinished() { return finished; }
    @Override public void end(boolean interrupted) { if (!ended) { finish(true); status("cancelled", "Test interrupted."); } if (active == this) active = null; }
  }
}
