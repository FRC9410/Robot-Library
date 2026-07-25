// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Contract for the shared data and live-tuning containers used by PowerLib. Implemented by
 * {@link frc.robot.RobotContainer}.
 * <p>
 * Subsystem telemetry is published under {@code /PowerLib/Subsystems/<name>/Data}. Subsystem
 * tunables are published under {@code /PowerLib/Subsystems/<name>/Variables}. Generated command
 * tunables are published under {@code /PowerLib/Commands/<name>/Variables}.
 */
public interface PowerRobotContainer {

  /** Legacy flat shared storage. Kept so older robot code can still call setData/getData. */
  Map<String, Object> SUBSYSTEM_DATA = new HashMap<>();
  Map<String, Map<String, Object>> GROUPED_SUBSYSTEM_DATA = new HashMap<>();
  Map<String, Map<String, Object>> SUBSYSTEM_VARIABLES = new HashMap<>();
  Map<String, Map<String, Object>> COMMAND_VARIABLES = new HashMap<>();
  AtomicBoolean TUNING_ENABLED = new AtomicBoolean(false);

  /**
   * Stores a legacy subsystem data value. Keys in the form {@code Subsystem/Metric} are routed to
   * {@link #setSubsystemData(String, String, Object)}.
   *
   * @param key   key to associate with the value
   * @param value value to store (may be null)
   */
  static void setData(String key, Object value) {
    SUBSYSTEM_DATA.put(key, value);

    String[] scopedKey = splitScopedKey(key);
    if (scopedKey.length == 2) {
      setSubsystemData(scopedKey[0], scopedKey[1], value);
    } else {
      setSubsystemData("Robot", key, value);
    }
  }

  static void setSubsystemData(String subsystemName, String key, Object value) {
    getMap(GROUPED_SUBSYSTEM_DATA, subsystemName).put(key, value);
  }

  /**
   * Retrieves a value from the shared data container, or null if the key is not present.
   *
   * @param key key to look up
   * @return the value, or "null" if the key is not present
   */
  static Object getData(String key) {
    return SUBSYSTEM_DATA.get(key);
  }

  static Map<String, Object> getAllData() {
    return SUBSYSTEM_DATA;
  }

  static Map<String, Map<String, Object>> getAllSubsystemData() {
    return GROUPED_SUBSYSTEM_DATA;
  }

  static void setTuningEnabled(boolean enabled) {
    TUNING_ENABLED.set(enabled);
  }

  static boolean isTuningEnabled() {
    return TUNING_ENABLED.get();
  }

  static void setSubsystemVariableDefault(String subsystemName, String key, Object defaultValue) {
    getMap(SUBSYSTEM_VARIABLES, subsystemName).putIfAbsent(key, defaultValue);
  }

  static void updateSubsystemVariable(String subsystemName, String key, Object value) {
    getMap(SUBSYSTEM_VARIABLES, subsystemName).put(key, value);
  }

  static Object getSubsystemVariable(String subsystemName, String key, Object defaultValue) {
    Map<String, Object> variables = getMap(SUBSYSTEM_VARIABLES, subsystemName);
    variables.putIfAbsent(key, defaultValue);
    return isTuningEnabled() ? variables.get(key) : defaultValue;
  }

  static double getSubsystemVariable(String subsystemName, String key, double defaultValue) {
    return toDouble(getSubsystemVariable(subsystemName, key, Double.valueOf(defaultValue)), defaultValue);
  }

  static boolean getSubsystemVariable(String subsystemName, String key, boolean defaultValue) {
    return toBoolean(getSubsystemVariable(subsystemName, key, Boolean.valueOf(defaultValue)), defaultValue);
  }

  static Map<String, Map<String, Object>> getAllSubsystemVariables() {
    return SUBSYSTEM_VARIABLES;
  }

  static void setCommandVariableDefault(String commandName, String key, Object defaultValue) {
    getMap(COMMAND_VARIABLES, commandName).putIfAbsent(key, defaultValue);
  }

  static void updateCommandVariable(String commandName, String key, Object value) {
    getMap(COMMAND_VARIABLES, commandName).put(key, value);
  }

  static Object getCommandVariable(String commandName, String key, Object defaultValue) {
    Map<String, Object> variables = getMap(COMMAND_VARIABLES, commandName);
    variables.putIfAbsent(key, defaultValue);
    return isTuningEnabled() ? variables.get(key) : defaultValue;
  }

  static double getCommandVariable(String commandName, String key, double defaultValue) {
    return toDouble(getCommandVariable(commandName, key, Double.valueOf(defaultValue)), defaultValue);
  }

  static boolean getCommandVariable(String commandName, String key, boolean defaultValue) {
    return toBoolean(getCommandVariable(commandName, key, Boolean.valueOf(defaultValue)), defaultValue);
  }

  static Map<String, Map<String, Object>> getAllCommandVariables() {
    return COMMAND_VARIABLES;
  }

  /**
   * Retrieves a value from the shared data container, or a default if the key is missing.
   *
   * @param key          key to look up
   * @param defaultValue value to return when key is absent or value is null
   * @param <T>          type of the value (inferred from defaultValue)
   * @return the stored value if present and non-null, otherwise defaultValue
   */
  @SuppressWarnings("unchecked")
  static <T> T getData(String key, T defaultValue) {
    Object value = SUBSYSTEM_DATA.get(key);
    return (value != null) ? (T) value : defaultValue;
  }

  private static Map<String, Object> getMap(Map<String, Map<String, Object>> root, String name) {
    return root.computeIfAbsent(normalizeName(name), ignored -> new HashMap<>());
  }

  private static String normalizeName(String name) {
    if (name == null || name.isBlank()) {
      return "Unknown";
    }
    return name.trim();
  }

  private static String[] splitScopedKey(String key) {
    if (key == null) {
      return new String[0];
    }

    String trimmed = key.trim();
    int slash = trimmed.indexOf('/');
    if (slash <= 0 || slash >= trimmed.length() - 1) {
      return new String[0];
    }

    return new String[] { trimmed.substring(0, slash), trimmed.substring(slash + 1) };
  }

  private static double toDouble(Object value, double defaultValue) {
    if (value instanceof Number) {
      return ((Number) value).doubleValue();
    }

    if (value instanceof String) {
      try {
        return Double.parseDouble((String) value);
      } catch (NumberFormatException ignored) {
        return defaultValue;
      }
    }

    return defaultValue;
  }

  private static boolean toBoolean(Object value, boolean defaultValue) {
    if (value instanceof Boolean) {
      return (Boolean) value;
    }

    if (value instanceof String) {
      String normalized = ((String) value).trim().toLowerCase();
      if (normalized.equals("true")
          || normalized.equals("1")
          || normalized.equals("yes")
          || normalized.equals("on")) {
        return true;
      }
      if (normalized.equals("false")
          || normalized.equals("0")
          || normalized.equals("no")
          || normalized.equals("off")) {
        return false;
      }
    }

    return defaultValue;
  }
}
