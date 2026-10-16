package frc.powerlib.configs;

/** Bounds on intermediate crossing evidence, in meters. Radius-only arrival is always available. */
public record WaypointHandoffConfig(boolean crossingEnabled, double maxOvershootMeters,
    double maxSampleTravelMeters) {
  public static final WaypointHandoffConfig RADIUS_ONLY = new WaypointHandoffConfig(false, 0, 0);

  public WaypointHandoffConfig {
    ConfigValidation.nonnegative(maxOvershootMeters, "maxOvershootMeters");
    ConfigValidation.nonnegative(maxSampleTravelMeters, "maxSampleTravelMeters");
    if (crossingEnabled) {
      ConfigValidation.positive(maxOvershootMeters, "maxOvershootMeters");
      ConfigValidation.positive(maxSampleTravelMeters, "maxSampleTravelMeters");
    }
  }
}
