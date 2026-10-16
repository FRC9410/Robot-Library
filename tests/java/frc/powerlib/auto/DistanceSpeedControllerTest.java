package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.math.geometry.Translation2d;
import java.util.List;
import org.junit.Test;

public class DistanceSpeedControllerTest {
  @Test public void singlePointRequestsMatchTheOriginalDistanceAndFeedforwardCalculation() {
    var destination = new Translation2d(3, 4);
    var path = new PathDistance(List.of(destination));
    double threshold = 0.0762;
    try (var baseline = new PIDController(3.2, 0, 0.2);
        var shared = new DistanceSpeedController(new PIDController(3.2, 0, 0.2), threshold)) {
      baseline.reset();
      shared.reset();
      for (double[] sample : new double[][] {{0, 0, 0.4}, {1, 1, 0.4}, {2.98, 3.99, 0.4}, {3, 4, 0.4},
          {3.2, 4.1, 0.7}, {2.9, 3.8, 0}}) {
        var position = new Translation2d(sample[0], sample[1]);
        double distance = destination.minus(position).getNorm();
        double expected = Math.abs(baseline.calculate(distance, 0)) + (distance >= threshold ? sample[2] : 0);
        assertEquals(expected, shared.calculate(path.remainingDistance(position, 0), sample[2]), 1e-9);
      }
    }
  }

  @Test public void feedforwardThresholdAndMagnitudeTakeEffectWithoutChangingGains() {
    try (var controller = new DistanceSpeedController(new PIDController(2, 0, 0), 0.1)) {
      assertEquals(0.18, controller.calculate(0.09, 0.5), 1e-9);
      assertEquals(0.7, controller.calculate(0.1, 0.5), 1e-9);
      assertEquals(1.0, controller.calculate(0.1, 0.8), 1e-9);
      assertEquals(0.2, controller.calculate(0.1, 0), 1e-9);
    }
  }

  @Test public void resetClearsHistoryAndRemainingRouteDrivesTheSpeedRequest() {
    var path = new PathDistance(List.of(new Translation2d(3, 0), new Translation2d(3, 4)));
    try (var controller = new DistanceSpeedController(new PIDController(1, 0, 0.2), 0.1)) {
      double distance = path.remainingDistance(new Translation2d(1, 0), 0);
      double first = controller.calculate(distance, 0);
      controller.calculate(1, 0);
      controller.reset();
      assertEquals(first, controller.calculate(distance, 0), 1e-9);
    }
    try (var controller = new DistanceSpeedController(new PIDController(1, 0, 0), 0.1)) {
      assertEquals(6, controller.calculate(path.remainingDistance(new Translation2d(1, 0), 0), 0), 1e-9);
      assertEquals(3, controller.calculate(path.remainingDistance(new Translation2d(3, 1), 1), 0), 1e-9);
    }
  }

  @Test public void invalidInputsDoNotAdvancePidHistory() {
    try (var baseline = new PIDController(3.2, 0, 0.2);
        var shared = new DistanceSpeedController(new PIDController(3.2, 0, 0.2), 0.1)) {
      baseline.calculate(2, 0);
      shared.calculate(2, 0);
      for (double invalid : new double[] {-1, Double.NaN, Double.POSITIVE_INFINITY}) {
        assertThrows(IllegalArgumentException.class, () -> shared.calculate(invalid, 0));
        assertThrows(IllegalArgumentException.class, () -> shared.calculate(1, invalid));
      }
      assertEquals(Math.abs(baseline.calculate(1, 0)), shared.calculate(1, 0), 1e-9);
    }
    assertThrows(NullPointerException.class, () -> new DistanceSpeedController(null, 0.1));
    try (var pid = new PIDController(1, 0, 0)) {
      for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
        assertThrows(IllegalArgumentException.class, () -> new DistanceSpeedController(pid, invalid));
      }
    }
  }
}
