package frc.powerlib.tuning;

import frc.powerlib.PowerRobotContainer;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.LinkedHashMap;
import java.util.Map;

/** Registers numeric constants and updates their fields from the subsystem tuning values. */
public final class TunableConstants {
  private record Binding(String owner, String key, Field field, Number defaultValue) {}

  private static final Map<Field, Binding> bindings = new LinkedHashMap<>();
  private static final TuningCadence cadence = new TuningCadence();

  private TunableConstants() {}

  public static void register(Class<?> constantsClass) {
    String owner = constantsClass.getSimpleName().replaceFirst("Constants$", "");
    for (Field field : constantsClass.getDeclaredFields()) {
      if (!field.isAnnotationPresent(TunableConstant.class) || bindings.containsKey(field)) {
        continue;
      }
      int modifiers = field.getModifiers();
      if (!Modifier.isPublic(modifiers) || !Modifier.isStatic(modifiers)
          || Modifier.isFinal(modifiers)) {
        throw new IllegalArgumentException("Tunable constant must be public, static, and mutable: " + field);
      }
      try {
        Object value = field.get(null);
        if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue())) {
          throw new IllegalArgumentException("Tunable constant must be a finite number: " + field);
        }
        String key = "Custom/" + field.getName();
        bindings.put(field, new Binding(owner, key, field, number));
        PowerRobotContainer.setSubsystemVariableDefault(owner, key, number);
      } catch (IllegalAccessException exception) {
        throw new IllegalStateException("Could not register tunable constant " + field, exception);
      }
    }
  }

  /** Apply live values while enabled; keep the last applied fields and skip all bindings otherwise. */
  public static void sync() {
    if (!PowerRobotContainer.isTuningEnabled() || !cadence.isDue()) {
      return;
    }
    for (Binding binding : bindings.values()) {
      Object requested = PowerRobotContainer.getSubsystemVariable(
          binding.owner(), binding.key(), (Object) binding.defaultValue());
      Number value = requested instanceof Number number
          ? convert(number, binding.field().getType()) : null;
      if (value == null) {
        value = binding.defaultValue();
      }
      try {
        if (!value.equals(binding.field().get(null))) binding.field().set(null, value);
      } catch (IllegalAccessException exception) {
        throw new IllegalStateException("Could not update tunable constant " + binding.field(), exception);
      }
    }
  }

  private static Number convert(Number number, Class<?> type) {
    double value = number.doubleValue();
    if (!Double.isFinite(value)) return null;
    if (type == double.class || type == Double.class) return value;
    if (type == float.class || type == Float.class) {
      return Float.isFinite((float) value) ? (float) value : null;
    }
    if (value != Math.rint(value)) return null;
    if (type == long.class || type == Long.class) {
      // NetworkTables numeric values use doubles. Stay in the exactly represented integer range.
      return Math.abs(value) <= 9007199254740991.0 ? (long) value : null;
    }
    if (type == int.class || type == Integer.class) {
      return value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE ? (int) value : null;
    }
    if (type == short.class || type == Short.class) {
      return value >= Short.MIN_VALUE && value <= Short.MAX_VALUE ? (short) value : null;
    }
    if (type == byte.class || type == Byte.class) {
      return value >= Byte.MIN_VALUE && value <= Byte.MAX_VALUE ? (byte) value : null;
    }
    return null;
  }
}
