// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Contract for the shared data and live-tuning containers used by PowerLib. Implemented by
 * {@link frc.robot.RobotContainer}.
 * <p>
 * Subsystem telemetry is published under {@code /PowerLib/Subsystems/<name>/Data}. Subsystem
 * tunables are published under {@code /PowerLib/Subsystems/<name>/Variables}. Command
 * tunables are published under {@code /PowerLib/Commands/<name>/Variables}.
 */
public interface PowerRobotContainer {

  /** Legacy flat shared storage. Kept so older robot code can still call setData/getData. */
  Map<String, Object> SUBSYSTEM_DATA = new HashMap<>();
  Map<String, Map<String, Object>> GROUPED_SUBSYSTEM_DATA = new HashMap<>();
  Map<String, Map<String, String>> SUBSYSTEM_DATA_UNITS = new HashMap<>();
  Map<String, Map<String, Object>> SUBSYSTEM_VARIABLES = new HashMap<>();
  Map<String, Map<String, Object>> COMMAND_VARIABLES = new HashMap<>();
  AtomicBoolean TUNING_ENABLED = new AtomicBoolean(false);
  AtomicLong SUBSYSTEM_VARIABLES_REVISION = new AtomicLong();
  AtomicLong COMMAND_VARIABLES_REVISION = new AtomicLong();

  /**
   * Stores a legacy subsystem data value. Keys in the form {@code Subsystem/Metric} are routed to
   * {@link #setSubsystemData(String, String, Object)}.
   *
   * @param key   key to associate with the value
   * @param value value to store (may be null)
   */
  static void setData(String key, Object value) {
    setData(key, value, "");
  }

  /** Stores shared telemetry with units for numeric signal log entries. */
  static void setData(String key, Object value, String units) {
    SUBSYSTEM_DATA.put(key, value);

    String[] scopedKey = splitScopedKey(key);
    if (scopedKey.length == 2) {
      setSubsystemData(scopedKey[0], scopedKey[1], value, units);
    } else {
      setSubsystemData("Robot", key, value, units);
    }
  }

  static void setSubsystemData(String subsystemName, String key, Object value) {
    getMap(GROUPED_SUBSYSTEM_DATA, subsystemName).put(key, value);
  }

  /** Stores telemetry and its numeric units; both destinations use the same value. */
  static void setSubsystemData(String subsystemName, String key, Object value, String units) {
    setSubsystemData(subsystemName, key, value);
    SUBSYSTEM_DATA_UNITS.computeIfAbsent(normalizeName(subsystemName), ignored -> new HashMap<>())
        .put(key, units == null ? "" : units);
  }

  static String getSubsystemDataUnits(String subsystemName, String key) {
    Map<String, String> units = SUBSYSTEM_DATA_UNITS.get(normalizeName(subsystemName));
    return units == null ? "" : units.getOrDefault(key, "");
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
    setVariableDefault(
        SUBSYSTEM_VARIABLES, SUBSYSTEM_VARIABLES_REVISION, subsystemName, key, defaultValue);
  }

  static void updateSubsystemVariable(String subsystemName, String key, Object value) {
    updateVariable(SUBSYSTEM_VARIABLES, SUBSYSTEM_VARIABLES_REVISION, subsystemName, key, value);
  }

  /** Returns the last synchronized value, which remains cached while tuning is disabled. */
  static Object getSubsystemVariable(String subsystemName, String key, Object defaultValue) {
    Map<String, Object> variables = setVariableDefault(
        SUBSYSTEM_VARIABLES, SUBSYSTEM_VARIABLES_REVISION, subsystemName, key, defaultValue);
    Object value = variables.get(key);
    return value != null ? value : defaultValue;
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

  /** Changes only when a new subsystem tunable is registered, including through a getter. */
  static long getSubsystemVariablesRevision() {
    return SUBSYSTEM_VARIABLES_REVISION.get();
  }

  static void setCommandVariableDefault(String commandName, String key, Object defaultValue) {
    setVariableDefault(COMMAND_VARIABLES, COMMAND_VARIABLES_REVISION, commandName, key, defaultValue);
  }

  static void updateCommandVariable(String commandName, String key, Object value) {
    updateVariable(COMMAND_VARIABLES, COMMAND_VARIABLES_REVISION, commandName, key, value);
  }

  /** Returns the last synchronized value, which remains cached while tuning is disabled. */
  static Object getCommandVariable(String commandName, String key, Object defaultValue) {
    Map<String, Object> variables = setVariableDefault(
        COMMAND_VARIABLES, COMMAND_VARIABLES_REVISION, commandName, key, defaultValue);
    Object value = variables.get(key);
    return value != null ? value : defaultValue;
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

  /** Changes only when a new command tunable is registered, including through a getter. */
  static long getCommandVariablesRevision() {
    return COMMAND_VARIABLES_REVISION.get();
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

  private static Map<String, Object> setVariableDefault(
      Map<String, Map<String, Object>> root, AtomicLong revision,
      String owner, String key, Object defaultValue) {
    Map<String, Object> variables = getMap(root, owner);
    boolean registered = variables.containsKey(key);
    variables.putIfAbsent(key, defaultValue);
    if (!registered) {
      revision.incrementAndGet();
    }
    return variables;
  }

  private static void updateVariable(
      Map<String, Map<String, Object>> root, AtomicLong revision,
      String owner, String key, Object value) {
    Map<String, Object> variables = getMap(root, owner);
    boolean registered = variables.containsKey(key);
    variables.put(key, value);
    if (!registered) {
      revision.incrementAndGet();
    }
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
