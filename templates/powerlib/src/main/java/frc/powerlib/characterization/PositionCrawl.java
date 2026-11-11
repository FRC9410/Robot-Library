package frc.powerlib.characterization;

import edu.wpi.first.wpilibj2.command.Subsystem;
import java.util.Map;
import java.util.function.DoubleConsumer;
import java.util.function.Supplier;

/** A supervised, short open-loop nudge with robot-side position and speed cutoffs. */
final class PositionCrawl {
  record Feedback(double position, double velocity) {}
  record Target(String id, String name, Subsystem owner, DoubleConsumer voltage, Runnable stop,
      Supplier<Feedback> feedback, double softMin, double softMax) {}

  private static final double PULSE_SECONDS = 0.15;
  private static final double MAX_NUDGE_VOLTS = 0.45;
  private static final double REST_SPEED = 0.01;
  private final Target target;
  private final double lower, upper, margin;
  private Feedback feedback;
  private int direction;
  private double expires, speedLimit;

  PositionCrawl(Target target, double lower, double upper, double margin) {
    if (!Double.isFinite(lower) || !Double.isFinite(upper) || !Double.isFinite(margin)
        || !Double.isFinite(upper - lower) || margin <= 0 || margin >= (upper - lower) / 2
        || lower < target.softMin() || upper > target.softMax()) {
      throw new IllegalArgumentException("Enter a test window within the mechanism limits with room for the stopping margin.");
    }
    this.target = target;
    this.lower = lower;
    this.upper = upper;
    this.margin = margin;
    checkFeedback();
    if (Math.abs(feedback.velocity()) > REST_SPEED) throw new IllegalStateException("Wait until the mechanism is stationary.");
  }

  void verifySysIdStart() {
    checkFeedback();
    if (Math.abs(feedback.velocity()) > REST_SPEED || clearance() <= margin) {
      throw new IllegalStateException("Start stationary inside both stopping margins.");
    }
  }

  String sysIdCutoff(double maxSpeed) {
    checkFeedback();
    if (clearance() <= margin) return "Test ended at the stopping margin.";
    if (Math.abs(feedback.velocity()) >= maxSpeed) return "Test ended at the speed cutoff.";
    return "";
  }

  void checkFeedback() {
    feedback = target.feedback().get();
    if (feedback == null || !Double.isFinite(feedback.position()) || !Double.isFinite(feedback.velocity())) {
      throw new IllegalStateException("Fresh position and velocity feedback is required.");
    }
    if (feedback.position() < lower || feedback.position() > upper) {
      throw new IllegalStateException("Mechanism is outside the position test window.");
    }
  }

  String nudge(int nextDirection, double requestedSpeed, double now) {
    if (direction != 0) return null;
    if ((nextDirection != 1 && nextDirection != -1) || !Double.isFinite(requestedSpeed) || requestedSpeed <= 0) {
      throw new IllegalArgumentException("Invalid crawl direction or speed setting.");
    }
    if (Math.abs(feedback.velocity()) > REST_SPEED || Math.abs(feedback.velocity()) >= requestedSpeed) {
      return "Wait until the mechanism is stationary.";
    }
    if (clearance() <= margin) return "Inside the stopping margin. Reposition the mechanism while disabled.";
    direction = nextDirection;
    speedLimit = requestedSpeed;
    expires = now + PULSE_SECONDS;
    target.voltage().accept(direction * Math.min(MAX_NUDGE_VOLTS, 0.05 + 4 * speedLimit));
    return "";
  }

  String update(double now) {
    checkFeedback();
    if (direction == 0) return null;
    if (clearance() <= margin) return stop("Stopped at the stopping margin.");
    if (Math.abs(feedback.velocity()) >= speedLimit) return stop("Stopped at the crawl speed cutoff.");
    if (now >= expires) return stop("Nudge complete.");
    return null;
  }

  Map<String, Double> status() {
    return feedback == null || !Double.isFinite(feedback.position()) || !Double.isFinite(feedback.velocity())
        ? Map.of() : Map.of("position", feedback.position(), "velocity", feedback.velocity());
  }

  void stop() { stop(""); }

  private String stop(String message) {
    direction = 0;
    target.stop().run();
    return message;
  }

  private double clearance() {
    return Math.min(upper - feedback.position(), feedback.position() - lower);
  }
}
