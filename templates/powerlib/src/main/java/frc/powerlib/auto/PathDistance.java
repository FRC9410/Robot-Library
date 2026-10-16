package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Translation2d;
import java.util.List;
import java.util.Objects;

/** Distance through ordered destinations to one intended stop; does not select or advance targets. */
public final class PathDistance {
  private final List<Translation2d> destinations;
  private final double[] distanceAfterDestination;

  public PathDistance(List<Translation2d> destinations) {
    this.destinations = List.copyOf(destinations);
    if (this.destinations.isEmpty()) throw new IllegalArgumentException("Path must have a destination");
    for (var point : this.destinations) requireFinite(point);
    distanceAfterDestination = new double[this.destinations.size()];
    for (int i = this.destinations.size() - 2; i >= 0; i--) {
      distanceAfterDestination[i] = requireFiniteDistance(
          this.destinations.get(i).getDistance(this.destinations.get(i + 1)) + distanceAfterDestination[i + 1]);
    }
  }

  /** Current distance to the supplied active target, plus the cached distance after that target. */
  public double remainingDistance(Translation2d currentPosition, int activeDestinationIndex) {
    Objects.checkIndex(activeDestinationIndex, destinations.size());
    requireFinite(currentPosition);
    return requireFiniteDistance(currentPosition.getDistance(destinations.get(activeDestinationIndex))
        + distanceAfterDestination[activeDestinationIndex]);
  }

  private static void requireFinite(Translation2d position) {
    Objects.requireNonNull(position, "position");
    if (!Double.isFinite(position.getX()) || !Double.isFinite(position.getY())) {
      throw new IllegalArgumentException("Path positions must be finite");
    }
  }

  private static double requireFiniteDistance(double distance) {
    if (!Double.isFinite(distance)) throw new IllegalArgumentException("Path distance exceeds finite range");
    return distance;
  }
}
