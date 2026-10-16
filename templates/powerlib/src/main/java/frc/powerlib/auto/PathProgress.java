package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Translation2d;
import frc.powerlib.configs.MotionConstraints;
import frc.powerlib.configs.PathWaypoint;
import java.util.List;

/** Ordered radius-based progress and cached speed bounds for a path ending at one intended stop. */
public final class PathProgress {
  private final List<PathWaypoint> waypoints;
  private final PathDistance distance;
  private final MotionConstraints constraints;
  private final double[] exitSpeeds;
  private int index;

  public PathProgress(List<PathWaypoint> waypoints) {
    this.waypoints = List.copyOf(waypoints);
    if (this.waypoints.isEmpty()) throw new IllegalArgumentException("Path needs at least one waypoint");
    distance = new PathDistance(this.waypoints.stream().map(point -> point.pose().getTranslation()).toList());
    double maxSpeed = 0;
    double acceleration = Double.POSITIVE_INFINITY;
    double angularSpeed = Double.POSITIVE_INFINITY;
    double angularAcceleration = Double.POSITIVE_INFINITY;
    for (var point : this.waypoints) {
      var limits = point.constraints();
      maxSpeed = Math.max(maxSpeed, limits.maxVelocityMetersPerSecond());
      acceleration = Math.min(acceleration, limits.maxAccelerationMetersPerSecondSquared());
      angularSpeed = Math.min(angularSpeed, limits.maxAngularVelocityRadiansPerSecond());
      angularAcceleration = Math.min(angularAcceleration, limits.maxAngularAccelerationRadiansPerSecondSquared());
    }
    // A single limiter uses the most conservative acceleration and angular limits in the section.
    constraints = new MotionConstraints(maxSpeed, acceleration, angularSpeed, angularAcceleration);
    exitSpeeds = new double[this.waypoints.size()]; // The endpoint requires zero exit speed.
    for (int i = exitSpeeds.length - 2; i >= 0; i--) {
      var current = this.waypoints.get(i);
      var next = this.waypoints.get(i + 1);
      double availableDistance = Math.max(0, current.pose().getTranslation().getDistance(next.pose().getTranslation())
          - current.completion().translationToleranceMeters() - next.completion().translationToleranceMeters());
      exitSpeeds[i] = Math.min(next.constraints().maxVelocityMetersPerSecond(),
          speedBeforeBraking(exitSpeeds[i + 1], availableDistance));
    }
  }

  public void reset() { index = 0; }
  public int index() { return index; }
  public PathWaypoint current() { return waypoints.get(index); }
  public PathWaypoint endpoint() { return waypoints.get(waypoints.size() - 1); }
  public boolean atEndpoint() { return index == waypoints.size() - 1; }
  public MotionConstraints constraints() { return constraints; }

  /** Advances reached intermediate points in order, including duplicates; never completes the endpoint. */
  public boolean advance(Translation2d position) {
    requireFinite(position);
    int previous = index;
    while (!atEndpoint() && position.getDistance(current().pose().getTranslation())
        <= current().completion().translationToleranceMeters()) index++;
    return index != previous;
  }

  public double remainingDistance(Translation2d position) {
    return distance.remainingDistance(position, index);
  }

  /** Desired speed ceiling accounting for lower future limits and the final stop. */
  public double maxTranslationSpeed(Translation2d position) {
    requireFinite(position);
    double availableDistance = Math.max(0, position.getDistance(current().pose().getTranslation())
        - current().completion().translationToleranceMeters());
    return Math.min(current().constraints().maxVelocityMetersPerSecond(),
        speedBeforeBraking(exitSpeeds[index], availableDistance));
  }

  private double speedBeforeBraking(double exitSpeed, double distanceMeters) {
    return Math.hypot(exitSpeed,
        Math.sqrt(2 * constraints.maxAccelerationMetersPerSecondSquared() * distanceMeters));
  }

  private static void requireFinite(Translation2d position) {
    if (position == null || !Double.isFinite(position.getX()) || !Double.isFinite(position.getY())) {
      throw new IllegalArgumentException("Path position must be finite");
    }
  }
}
