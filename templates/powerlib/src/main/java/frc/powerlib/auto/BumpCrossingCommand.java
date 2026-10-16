package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Subsystem;
import frc.powerlib.configs.BumpCrossingConfig;
import frc.powerlib.health.HealthChecks;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.DoubleSupplier;

/** Crosses in the robot's initial forward/reverse direction without wheel-position completion. */
public class BumpCrossingCommand extends Command {
  public enum Phase { APPROACH, CLIMBING, DESCENDING, CLEARING, RECOVERING, SUCCEEDED, FAILED, INTERRUPTED }

  /** Reused input buffer. Pitch is positive nose-up; roll and yaw follow the adapter's gyro frame. */
  public static final class Inputs {
    public double yawRadians;
    public double pitchDegrees;
    public double rollDegrees;
    public ChassisSpeeds robotSpeeds = new ChassisSpeeds();
    public boolean healthy;
    public double signalAgeSeconds = Double.POSITIVE_INFINITY;
    /** Capture time of the latest position frame actually fused, in the clock's time base. */
    public double visionPositionTimestampSeconds = Double.NEGATIVE_INFINITY;
  }

  /** Read cached feedback without waiting. The heading controller is independent of manual driving. */
  public interface Drive {
    void readInputs(Inputs inputs);
    void resetHeadingController();
    double headingRate(Rotation2d current, Rotation2d target);
    void applyRobotSpeeds(ChassisSpeeds speeds);
    void stop();
    default void recordPhase(Phase phase) {}
  }

  private final BumpCrossingConfig config;
  private final Drive drive;
  private final Consumer<String> abort;
  private final DoubleSupplier clock;
  private final double direction;
  private final Inputs inputs = new Inputs();
  private final ChassisSpeeds desired = new ChassisSpeeds();
  private final ChassisMotionLimiter limiter;
  private Phase phase = Phase.INTERRUPTED;
  private Rotation2d startYaw;
  private double started;
  private double lastTimestamp;
  private double phaseStarted;
  private double conditionSince = Double.NaN;
  private String failureReason = "";

  public BumpCrossingCommand(Subsystem drivetrain, Drive drive, BumpCrossingConfig config,
      boolean reversed, Consumer<String> abort) {
    this(drivetrain, drive, config, reversed, abort, Timer::getFPGATimestamp);
  }

  /** Clock injection supports deterministic hardware-independent tests. */
  public BumpCrossingCommand(Subsystem drivetrain, Drive drive, BumpCrossingConfig config,
      boolean reversed, Consumer<String> abort, DoubleSupplier clock) {
    this.drive = Objects.requireNonNull(drive, "drive");
    this.config = Objects.requireNonNull(config, "config");
    this.abort = Objects.requireNonNull(abort, "abort");
    this.clock = Objects.requireNonNull(clock, "clock");
    direction = reversed ? -1 : 1;
    limiter = new ChassisMotionLimiter(config.motion());
    addRequirements(Objects.requireNonNull(drivetrain, "drivetrain"));
  }

  public Phase phase() { return phase; }
  public boolean wasSuccessful() { return phase == Phase.SUCCEEDED; }
  public String failureReason() { return failureReason; }

  @Override public void initialize() {
    failureReason = "";
    started = lastTimestamp = clock.getAsDouble();
    transition(Phase.APPROACH, started);
    if (!readFeedback(started)) return;
    if (!level()) { fail("Bump crossing must start on level ground"); return; }
    startYaw = Rotation2d.fromRadians(inputs.yawRadians);
    drive.resetHeadingController();
    limiter.reset(inputs.robotSpeeds); // At initialization the robot frame is the fixed crossing frame.
  }

  @Override public void execute() {
    if (isFinished()) return;
    double now = clock.getAsDouble();
    if (!readFeedback(now)) return;
    if (now < lastTimestamp) { fail("Bump control time moved backward"); return; }
    if (now - started >= config.timeoutSeconds()) { fail("Bump crossing timed out in " + phase); return; }
    double elapsed = now - lastTimestamp;
    lastTimestamp = now;
    double tilt = inputs.pitchDegrees * direction;
    switch (phase) {
      case APPROACH -> {
        if (confirmed(tilt >= config.tiltThresholdDegrees(), now, config.tiltDebounceSeconds())) {
          transition(Phase.CLIMBING, now);
        }
      }
      case CLIMBING -> {
        if (confirmed(tilt <= -config.tiltThresholdDegrees(), now, config.tiltDebounceSeconds())) {
          transition(Phase.DESCENDING, now);
        }
      }
      case DESCENDING -> {
        if (confirmed(level(), now, config.levelSettleSeconds())) transition(Phase.CLEARING, now);
      }
      case CLEARING -> {
        if (!level()) transition(Phase.DESCENDING, now);
        else if (now - phaseStarted >= config.clearanceSeconds()) {
          transition(Phase.RECOVERING, now);
          drive.resetHeadingController();
        }
      }
      default -> { }
    }
    try {
      var yaw = Rotation2d.fromRadians(inputs.yawRadians);
      desired.vxMetersPerSecond = phase == Phase.RECOVERING ? 0 : direction * config.speedMetersPerSecond();
      desired.vyMetersPerSecond = 0;
      desired.omegaRadiansPerSecond = phase == Phase.RECOVERING ? 0 : drive.headingRate(yaw, startYaw);
      var limited = limiter.calculate(desired, elapsed);
      // Limit in the fixed starting frame, then rotate the request into the robot's current frame.
      drive.applyRobotSpeeds(ChassisSpeeds.fromFieldRelativeSpeeds(limited, yaw.minus(startYaw)));
      if (phase == Phase.RECOVERING) {
        boolean stopped = level()
            && Math.hypot(limited.vxMetersPerSecond, limited.vyMetersPerSecond) < 1e-9
            && Math.abs(limited.omegaRadiansPerSecond) < 1e-9
            && Math.hypot(inputs.robotSpeeds.vxMetersPerSecond, inputs.robotSpeeds.vyMetersPerSecond)
                <= config.stoppedSpeedMetersPerSecond()
            && Math.abs(inputs.robotSpeeds.omegaRadiansPerSecond) <= config.stoppedAngularSpeedRadiansPerSecond();
        boolean settled = confirmed(stopped, now, config.levelSettleSeconds());
        boolean recovered = !config.requireVisionRecovery()
            || inputs.visionPositionTimestampSeconds > phaseStarted
                && HealthChecks.isFresh(now - inputs.visionPositionTimestampSeconds, config.maxSignalAgeSeconds());
        if (settled && recovered) {
          transition(Phase.SUCCEEDED, now);
          drive.stop();
        }
      }
    } catch (IllegalArgumentException exception) {
      fail("Invalid bump motion request");
    }
  }

  private boolean readFeedback(double now) {
    if (!Double.isFinite(now) || now < 0) { fail("Invalid bump control time"); return false; }
    try {
      drive.readInputs(inputs);
    } catch (RuntimeException exception) {
      fail("Bump feedback unavailable"); return false;
    }
    if (!inputs.healthy || !HealthChecks.isFresh(inputs.signalAgeSeconds, config.maxSignalAgeSeconds())
        || !Double.isFinite(inputs.yawRadians) || !Double.isFinite(inputs.pitchDegrees)
        || !Double.isFinite(inputs.rollDegrees) || !HealthChecks.finiteSpeeds(inputs.robotSpeeds)) {
      fail("Bump feedback unavailable"); return false;
    }
    return true;
  }

  private boolean level() {
    return Math.abs(inputs.pitchDegrees) <= config.levelToleranceDegrees()
        && Math.abs(inputs.rollDegrees) <= config.levelToleranceDegrees();
  }

  private boolean confirmed(boolean condition, double now, double seconds) {
    if (!condition) { conditionSince = Double.NaN; return false; }
    if (Double.isNaN(conditionSince)) conditionSince = now;
    return now - conditionSince >= seconds;
  }

  private void transition(Phase next, double now) {
    phase = next;
    phaseStarted = now;
    conditionSince = Double.NaN;
    drive.recordPhase(next);
  }

  private void fail(String reason) {
    failureReason = reason;
    transition(Phase.FAILED, lastTimestamp);
    drive.stop();
    abort.accept(reason);
  }

  @Override public boolean isFinished() {
    return phase == Phase.SUCCEEDED || phase == Phase.FAILED || phase == Phase.INTERRUPTED;
  }

  @Override public void end(boolean interrupted) {
    drive.stop();
    if (interrupted && !isFinished()) {
      failureReason = "Bump crossing interrupted";
      transition(Phase.INTERRUPTED, lastTimestamp);
      abort.accept(failureReason);
    }
  }
}
