package frc.powerlib.auto;

import edu.wpi.first.math.controller.PIDController;
import frc.powerlib.configs.MotionConstraints;
import java.util.Objects;

/**
 * Converts nonnegative remaining distance into an unsigned speed request using the established
 * distance-PID magnitude and static-friction feedforward. Motion limits are applied separately.
 * Own one per command. This class takes ownership of the supplied PID controller.
 */
public final class DistanceSpeedController implements AutoCloseable {
  private final PIDController controller;
  private final double feedforwardThresholdMeters;

  public DistanceSpeedController(PIDController controller, double feedforwardThresholdMeters) {
    this.controller = Objects.requireNonNull(controller, "controller");
    if (!Double.isFinite(feedforwardThresholdMeters) || feedforwardThresholdMeters <= 0) {
      throw new IllegalArgumentException("feedforwardThresholdMeters must be positive and finite");
    }
    this.feedforwardThresholdMeters = feedforwardThresholdMeters;
  }

  public void reset() { controller.reset(); }

  /** Feedforward is supplied per update so changing the robot's speed calibration still takes effect. */
  public double calculate(double remainingDistanceMeters, double staticFeedforwardMetersPerSecond) {
    requireNonnegative(remainingDistanceMeters, "remainingDistanceMeters");
    requireNonnegative(staticFeedforwardMetersPerSecond, "staticFeedforwardMetersPerSecond");
    double speed = Math.abs(controller.calculate(remainingDistanceMeters, 0));
    if (remainingDistanceMeters >= feedforwardThresholdMeters) speed += staticFeedforwardMetersPerSecond;
    if (!Double.isFinite(speed)) throw new IllegalArgumentException("Distance controller produced nonfinite speed");
    return speed;
  }

  /** Zero inside tolerance; outside, cap the usual request by the stopping envelope. */
  public double calculateStopping(double remainingDistanceMeters, double staticFeedforwardMetersPerSecond,
      double translationToleranceMeters, MotionConstraints constraints) {
    requireNonnegative(remainingDistanceMeters, "remainingDistanceMeters");
    requireNonnegative(staticFeedforwardMetersPerSecond, "staticFeedforwardMetersPerSecond");
    requireNonnegative(translationToleranceMeters, "translationToleranceMeters");
    Objects.requireNonNull(constraints, "constraints");
    if (remainingDistanceMeters <= translationToleranceMeters) {
      reset();
      return 0;
    }
    return Math.min(calculate(remainingDistanceMeters, staticFeedforwardMetersPerSecond),
        constraints.maxTranslationSpeedToStop(remainingDistanceMeters - translationToleranceMeters));
  }

  private static void requireNonnegative(double value, String name) {
    if (!Double.isFinite(value) || value < 0) throw new IllegalArgumentException(name + " must be finite and nonnegative");
  }

  @Override public void close() { controller.close(); }
}
