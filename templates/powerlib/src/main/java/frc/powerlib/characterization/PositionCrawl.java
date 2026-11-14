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
  private final double lower, upper, lowerStop, upperStop;
  private final int polarity;
  private Feedback feedback;
  private int direction;
  private double expires, speedLimit;

  PositionCrawl(Target target, double lower, double upper, double lowerStop, double upperStop, int polarity) {
    if (!Double.isFinite(lower) || !Double.isFinite(upper) || !Double.isFinite(upper - lower)
        || !(lower < lowerStop && lowerStop < upperStop && upperStop < upper)
        || lower < target.softMin() || upper > target.softMax() || (polarity != 1 && polarity != -1)) {
      throw new IllegalArgumentException("Set Min, Lower stop, Upper stop, and Max in increasing order within the mechanism limits.");
    }
    this.target = target;
    this.lower = lower;
    this.upper = upper;
    this.lowerStop = lowerStop;
    this.upperStop = upperStop;
    this.polarity = polarity;
    checkFeedback();
    if (Math.abs(feedback.velocity()) > REST_SPEED) throw new IllegalStateException("Wait until the mechanism is stationary.");
  }

  void verifySysIdStart(int travelDirection) {
    checkFeedback();
    if (Math.abs(feedback.velocity()) > REST_SPEED || reachedStop(travelDirection) || movingOutward(travelDirection)) {
      throw new IllegalStateException("Start stationary before the stop in the test direction and clear of outward motion.");
    }
  }

  String sysIdCutoff(int travelDirection, double maxSpeed) {
    checkFeedback();
    if (reachedStop(travelDirection)) return "Test ended at the directional stop.";
    if (movingOutward(travelDirection)) throw new IllegalStateException("Mechanism moved toward its starting limit.");
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
    if (reachedStop(nextDirection * polarity)) return "Already at the stop in this direction. Flip direction or reposition the mechanism.";
    if (movingOutward(nextDirection * polarity)) return "Wait until the mechanism is stationary.";
    direction = nextDirection;
    speedLimit = requestedSpeed;
    expires = now + PULSE_SECONDS;
    target.voltage().accept(direction * Math.min(MAX_NUDGE_VOLTS, 0.05 + 4 * speedLimit));
    return "";
  }

  String update(double now) {
    checkFeedback();
    if (direction == 0) return null;
    int travelDirection = direction * polarity;
    if (reachedStop(travelDirection)) return stop("Stopped at the directional stop.");
    if (movingOutward(travelDirection)) return stop("Stopped because the mechanism moved toward its starting limit.");
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

  private boolean reachedStop(int travelDirection) {
    return travelDirection > 0 ? feedback.position() >= upperStop : feedback.position() <= lowerStop;
  }

  private boolean movingOutward(int travelDirection) {
    return travelDirection > 0
        ? feedback.position() <= lowerStop && feedback.velocity() < 0
        : feedback.position() >= upperStop && feedback.velocity() > 0;
  }
}
