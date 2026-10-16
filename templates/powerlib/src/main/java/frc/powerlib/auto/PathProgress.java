package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Translation2d;
import frc.powerlib.configs.MotionConstraints;
import frc.powerlib.configs.PathWaypoint;
import frc.powerlib.configs.WaypointHandoffConfig;
import java.util.List;
import java.util.Objects;

/** Ordered waypoint handoffs and cached speed bounds for a path ending at one intended stop. */
public final class PathProgress {
  /** Fixed segment geometry cached at reset. Zero-length legs keep a zero tangent here. */
  public static final class Segment {
    private final Translation2d start;
    private final Translation2d end;
    private final double length;
    private final double unitX;
    private final double unitY;

    public Segment(Translation2d start, Translation2d end) {
      requireFinite(start);
      requireFinite(end);
      this.start = start;
      this.end = end;
      double dx = end.getX() - start.getX();
      double dy = end.getY() - start.getY();
      length = Math.hypot(dx, dy);
      if (!Double.isFinite(length)) throw new IllegalArgumentException("Segment length exceeds finite range");
      unitX = length > 0 ? dx / length : 0;
      unitY = length > 0 ? dy / length : 0;
    }

    public Translation2d start() { return start; }
    public Translation2d end() { return end; }
    public double lengthMeters() { return length; }
    public double unitX() { return unitX; }
    public double unitY() { return unitY; }
  }

  private final List<PathWaypoint> waypoints;
  private final PathDistance distance;
  private final MotionConstraints constraints;
  private final double[] exitSpeeds;
  private final WaypointHandoffConfig handoff;
  private final double[] incomingX;
  private final double[] incomingY;
  private final Segment[] segments;
  private Translation2d previousPosition;
  private boolean directionsSeeded;
  private int index;

  public PathProgress(List<PathWaypoint> waypoints) {
    this(waypoints, WaypointHandoffConfig.RADIUS_ONLY);
  }

  public PathProgress(List<PathWaypoint> waypoints, WaypointHandoffConfig handoff) {
    this.handoff = Objects.requireNonNull(handoff, "handoff");
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
    incomingX = new double[exitSpeeds.length];
    incomingY = new double[exitSpeeds.length];
    segments = new Segment[exitSpeeds.length];
    for (int i = exitSpeeds.length - 2; i >= 0; i--) {
      var current = this.waypoints.get(i);
      var next = this.waypoints.get(i + 1);
      double availableDistance = Math.max(0, current.pose().getTranslation().getDistance(next.pose().getTranslation())
          - handoffExtent(i) - handoffExtent(i + 1));
      exitSpeeds[i] = Math.min(next.constraints().maxVelocityMetersPerSecond(),
          speedBeforeBraking(exitSpeeds[i + 1], availableDistance));
    }
  }

  /** Without a seed, the first valid observation establishes history and cannot prove a crossing. */
  public void reset() {
    index = 0;
    previousPosition = null;
    directionsSeeded = false;
  }

  public void reset(Translation2d startingPosition) {
    requireFinite(startingPosition);
    distance.remainingDistance(startingPosition, 0); // Validate before changing accepted state.
    seedDirections(startingPosition);
    index = 0;
    previousPosition = startingPosition;
  }

  public int index() { return index; }
  public PathWaypoint current() { return waypoints.get(index); }
  public PathWaypoint endpoint() { return waypoints.get(waypoints.size() - 1); }
  public boolean atEndpoint() { return index == waypoints.size() - 1; }
  public MotionConstraints constraints() { return constraints; }

  /** Available after reset(position) or the first valid observation; geometry stays fixed within the run. */
  public Segment currentSegment() {
    if (!directionsSeeded) throw new IllegalStateException("Seed path geometry before requesting a segment");
    return segments[index];
  }

  /** Radius arrival or bounded forward crossings advance intermediate points; endpoints never advance. */
  public boolean advance(Translation2d position) {
    if (!finite(position)) {
      previousPosition = null; // Invalid observations cannot bridge a later crossing.
      throw new IllegalArgumentException("Path position must be finite");
    }
    if (previousPosition == null) {
      if (!directionsSeeded) {
        distance.remainingDistance(position, 0);
        seedDirections(position);
      }
      previousPosition = position;
    }
    int previous = index;
    double sampleTravel = position.getDistance(previousPosition);
    boolean crossingSample = handoff.crossingEnabled() && sampleTravel > 0
        && sampleTravel <= handoff.maxSampleTravelMeters();
    double lastFraction = 0;
    while (!atEndpoint()) {
      double fraction = crossingSample ? crossingFraction(position, lastFraction) : Double.NaN;
      if (Double.isFinite(fraction)) {
        lastFraction = fraction;
      } else if (position.getDistance(current().pose().getTranslation())
          <= current().completion().translationToleranceMeters()) {
        lastFraction = 1; // Current-position arrival cannot justify an earlier crossing of the next target.
      } else {
        break;
      }
      index++;
    }
    previousPosition = position; // Rejected jumps and crossings cannot be replayed on the next update.
    return index != previous;
  }

  private double crossingFraction(Translation2d position, double minimumFraction) {
    var target = current().pose().getTranslation();
    double ux = incomingX[index];
    double uy = incomingY[index];
    double beforeX = previousPosition.getX() - target.getX();
    double beforeY = previousPosition.getY() - target.getY();
    double afterX = position.getX() - target.getX();
    double afterY = position.getY() - target.getY();
    double before = beforeX * ux + beforeY * uy;
    double after = afterX * ux + afterY * uy;
    double tolerance = current().completion().translationToleranceMeters();
    if (ux == 0 && uy == 0) {
      // The initial observation can already satisfy leading zero-length legs.
      return minimumFraction == 0 && previousPosition.getDistance(target) <= tolerance
          && position.getDistance(target) <= handoff.maxOvershootMeters() ? 0 : Double.NaN;
    }
    if (!Double.isFinite(before) || !Double.isFinite(after) || before >= 0 || after < 0
        || after > handoff.maxOvershootMeters() || Math.abs(-uy * afterX + ux * afterY) > tolerance) {
      return Double.NaN;
    }
    double fraction = -before / (after - before);
    double lateralBefore = -uy * beforeX + ux * beforeY;
    double lateralAfter = -uy * afterX + ux * afterY;
    double lateralAtCrossing = lateralBefore + fraction * (lateralAfter - lateralBefore);
    return fraction >= minimumFraction && fraction <= 1 && Math.abs(lateralAtCrossing) <= tolerance
        ? fraction : Double.NaN;
  }

  private void seedDirections(Translation2d startingPosition) {
    var origin = startingPosition;
    double ux = 0;
    double uy = 0;
    for (int i = 0; i < waypoints.size(); i++) {
      var target = waypoints.get(i).pose().getTranslation();
      var segment = new Segment(origin, target);
      segments[i] = segment;
      // Duplicate destinations inherit the last nonzero incoming direction.
      if (segment.lengthMeters() > 0) {
        ux = segment.unitX();
        uy = segment.unitY();
      }
      incomingX[i] = ux;
      incomingY[i] = uy;
      origin = target;
    }
    directionsSeeded = true;
  }

  private double handoffExtent(int pointIndex) {
    double tolerance = waypoints.get(pointIndex).completion().translationToleranceMeters();
    return handoff.crossingEnabled() && pointIndex < waypoints.size() - 1
        ? Math.hypot(tolerance, handoff.maxOvershootMeters()) : tolerance;
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
    if (!finite(position)) throw new IllegalArgumentException("Path position must be finite");
  }

  private static boolean finite(Translation2d position) {
    return position != null && Double.isFinite(position.getX()) && Double.isFinite(position.getY());
  }
}
