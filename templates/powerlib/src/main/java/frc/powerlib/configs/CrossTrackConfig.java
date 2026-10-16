package frc.powerlib.configs;

/** Lateral P gain (1/s) and correction speed cap (m/s). Either zero disables correction. */
public record CrossTrackConfig(double gainPerSecond, double maxCorrectionSpeedMetersPerSecond) {
  public static final CrossTrackConfig DISABLED = new CrossTrackConfig(0, 0);

  public CrossTrackConfig {
    ConfigValidation.nonnegative(gainPerSecond, "gainPerSecond");
    ConfigValidation.nonnegative(maxCorrectionSpeedMetersPerSecond, "maxCorrectionSpeedMetersPerSecond");
  }

  public boolean enabled() { return gainPerSecond > 0 && maxCorrectionSpeedMetersPerSecond > 0; }
}
