package frc.powerlib.configs;

/** Measured arrival requirements for a stopping move. Angles use radians and time uses seconds. */
public record CompletionCriteria(
    double translationToleranceMeters,
    double headingToleranceRadians,
    double maxTranslationSpeedMetersPerSecond,
    double maxAngularSpeedRadiansPerSecond,
    double settleTimeSeconds) {
  public CompletionCriteria {
    ConfigValidation.positive(translationToleranceMeters, "translationToleranceMeters");
    ConfigValidation.positive(headingToleranceRadians, "headingToleranceRadians");
    ConfigValidation.range(headingToleranceRadians, 0, Math.PI, "headingToleranceRadians");
    ConfigValidation.positive(maxTranslationSpeedMetersPerSecond, "maxTranslationSpeedMetersPerSecond");
    ConfigValidation.positive(maxAngularSpeedRadiansPerSecond, "maxAngularSpeedRadiansPerSecond");
    ConfigValidation.nonnegative(settleTimeSeconds, "settleTimeSeconds");
  }
}
