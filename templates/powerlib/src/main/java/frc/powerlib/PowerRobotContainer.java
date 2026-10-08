package frc.powerlib;

import java.util.Map;

/**
 * Shared telemetry and tuning API, owned by the robot thread. Dashboard data is published as
 * one frame at /PowerLib/Data; Drive/Pose also supplies the typed simulation pose.
 * Values remain cached while tuning is disabled. Returned maps and nested rows are read-only.
 */
public interface PowerRobotContainer {
  static void setData(String key, Object value) {
    String[] path = path(key);
    setSubsystemData(path[0], path[1], value);
  }
  static void setData(String key, Object value, String units) {
    String[] path = path(key);
    setSubsystemData(path[0], path[1], value, units);
  }
  static Object getData(String key) {
    String[] path = path(key);
    return PowerDataStore.INSTANCE.getData(path[0], path[1]);
  }
  @SuppressWarnings("unchecked")
  static <T> T getData(String key, T fallback) {
    Object value = getData(key);
    return value == null ? fallback : (T) value;
  }
  /** Read-only legacy snapshot; scoped keys and unscoped Robot aliases share the same values. */
  static Map<String, Object> getAllData() { return PowerDataStore.INSTANCE.flatData(); }
  static void setSubsystemData(String owner, String key, Object value) {
    PowerDataStore.INSTANCE.setData(owner, key, value, null);
  }
  static void setSubsystemData(String owner, String key, Object value, String units) {
    PowerDataStore.INSTANCE.setData(owner, key, value, units == null ? "" : units);
  }
  static Map<String, Map<String, Object>> getAllSubsystemData() { return PowerDataStore.INSTANCE.data(); }
  static String getSubsystemDataUnits(String owner, String key) { return PowerDataStore.INSTANCE.units(owner, key); }
  static void setTuningEnabled(boolean enabled) { PowerDataStore.INSTANCE.tuningEnabled(enabled); }
  static boolean isTuningEnabled() { return PowerDataStore.INSTANCE.tuningEnabled(); }

  static void setSubsystemVariableDefault(String owner, String key, Object value) {
    PowerDataStore.INSTANCE.variable(false, owner, key, value);
  }
  static void updateSubsystemVariable(String owner, String key, Object value) {
    PowerDataStore.INSTANCE.updateVariable(false, owner, key, value);
  }
  static Object getSubsystemVariable(String owner, String key, Object fallback) {
    return PowerDataStore.INSTANCE.variable(false, owner, key, fallback);
  }
  static double getSubsystemVariable(String owner, String key, double fallback) {
    return number(getSubsystemVariable(owner, key, (Object) fallback), fallback);
  }
  static boolean getSubsystemVariable(String owner, String key, boolean fallback) {
    return bool(getSubsystemVariable(owner, key, (Object) fallback), fallback);
  }
  static Map<String, Map<String, Object>> getAllSubsystemVariables() { return PowerDataStore.INSTANCE.variablesView(false); }
  static long getSubsystemVariablesRevision() { return PowerDataStore.INSTANCE.revision(false); }

  static void setCommandVariableDefault(String owner, String key, Object value) {
    PowerDataStore.INSTANCE.variable(true, owner, key, value);
  }
  static void updateCommandVariable(String owner, String key, Object value) {
    PowerDataStore.INSTANCE.updateVariable(true, owner, key, value);
  }
  static Object getCommandVariable(String owner, String key, Object fallback) {
    return PowerDataStore.INSTANCE.variable(true, owner, key, fallback);
  }
  static double getCommandVariable(String owner, String key, double fallback) {
    return number(getCommandVariable(owner, key, (Object) fallback), fallback);
  }
  static boolean getCommandVariable(String owner, String key, boolean fallback) {
    return bool(getCommandVariable(owner, key, (Object) fallback), fallback);
  }
  static Map<String, Map<String, Object>> getAllCommandVariables() { return PowerDataStore.INSTANCE.variablesView(true); }
  static long getCommandVariablesRevision() { return PowerDataStore.INSTANCE.revision(true); }

  private static String[] path(String key) {
    if (key == null || key.isBlank()) throw new IllegalArgumentException("PowerLib metric key must not be blank.");
    String trimmed = key.trim(); int slash = trimmed.indexOf('/');
    if (slash <= 0 || slash == trimmed.length() - 1) return new String[] { "Robot", trimmed };
    return new String[] { trimmed.substring(0, slash), trimmed.substring(slash + 1) };
  }
  private static double number(Object value, double fallback) {
    try {
      double number = value instanceof Number numeric ? numeric.doubleValue()
          : value instanceof String text ? Double.parseDouble(text) : Double.NaN;
      return Double.isFinite(number) ? number : fallback;
    } catch (NumberFormatException exception) { return fallback; }
  }
  private static boolean bool(Object value, boolean fallback) {
    if (value instanceof Boolean flag) return flag;
    if (value instanceof String text) return switch (text.trim().toLowerCase(java.util.Locale.ROOT)) {
      case "true", "1", "yes", "on" -> true;
      case "false", "0", "no", "off" -> false;
      default -> fallback;
    };
    return fallback;
  }
}
