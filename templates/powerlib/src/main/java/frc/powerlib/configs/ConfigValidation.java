package frc.powerlib.configs;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Shared constructor checks; no hardware or NetworkTables access. */
final class ConfigValidation {
  private ConfigValidation() {}

  static void finite(double value, String name) {
    if (!Double.isFinite(value)) throw new IllegalArgumentException(name + " must be finite");
  }

  static void positive(double value, String name) {
    finite(value, name);
    if (value <= 0) throw new IllegalArgumentException(name + " must be positive");
  }

  static void nonnegative(double value, String name) {
    finite(value, name);
    if (value < 0) throw new IllegalArgumentException(name + " must be nonnegative");
  }

  static void range(double value, double minimum, double maximum, String name) {
    finite(value, name);
    if (value < minimum || value > maximum) {
      throw new IllegalArgumentException(name + " must be in [" + minimum + ", " + maximum + "]");
    }
  }

  static void optional(Optional<Double> value, String name) {
    Objects.requireNonNull(value, name).ifPresent(number -> finite(number, name));
  }

  static String text(String value, String name) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " must not be blank");
    return value;
  }

  static void subsystemName(String value) {
    text(value, "subsystemName");
    if (value.contains("/")) throw new IllegalArgumentException("subsystemName must not contain '/'");
  }

  static List<MotorConfig> motors(List<MotorConfig> values) {
    List<MotorConfig> copy = List.copyOf(values);
    var ids = new HashSet<Integer>();
    boolean leader = false;
    for (MotorConfig motor : copy) {
      if (!ids.add(motor.canId())) throw new IllegalArgumentException("Duplicate motor CAN ID " + motor.canId());
      leader |= !motor.isFollower();
    }
    if (!copy.isEmpty() && !leader) throw new IllegalArgumentException("Motor list needs a leader");
    return copy;
  }
}
