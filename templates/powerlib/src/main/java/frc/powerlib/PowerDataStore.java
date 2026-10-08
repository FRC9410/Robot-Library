package frc.powerlib;

import edu.wpi.first.math.geometry.Pose2d;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/** Single-thread-owned storage. Exposed maps and their nested rows are read-only. */
final class PowerDataStore {
  static final PowerDataStore INSTANCE = new PowerDataStore();
  private volatile Thread owner;
  private final Groups<Object> data = new Groups<>();
  private final Groups<String> units = new Groups<>();
  private final Groups<Object> subsystemVariables = new Groups<>();
  private final Groups<Object> commandVariables = new Groups<>();
  private boolean tuningEnabled;

  private static final class Groups<T> {
    final Map<String, Map<String, T>> rows = new HashMap<>();
    final Map<String, Map<String, T>> views = new HashMap<>();
    final Map<String, Map<String, T>> view = Collections.unmodifiableMap(views);
    long revision;
    Map<String, T> row(String name) {
      Map<String, T> row = rows.get(name);
      if (row == null) {
        row = new HashMap<>(); rows.put(name, row);
        views.put(name, Collections.unmodifiableMap(row));
      }
      return row;
    }
  }

  private void checkAccess() {
    Thread current = Thread.currentThread();
    if (owner == null) synchronized (this) { if (owner == null) owner = current; }
    if (owner != current) throw new IllegalStateException("PowerLib shared data must be accessed on its robot thread: " + owner.getName());
  }
  private static String name(String name) {
    if (name == null || name.isBlank() || name.contains("/"))
      throw new IllegalArgumentException("PowerLib owner name must be nonblank and must not contain '/': " + name);
    return name.trim();
  }
  private static void key(String key) {
    if (key == null || key.isBlank()) throw new IllegalArgumentException("PowerLib metric key must not be blank.");
  }
  void setData(String owner, String key, Object value, String unit) {
    checkAccess(); owner = name(owner); key(key);
    if (owner.equals("Drive") && key.equals("Pose") && value != null && !(value instanceof Pose2d))
      throw new IllegalArgumentException("Drive/Pose must be a Pose2d or null.");
    data.row(owner).put(key, value);
    if (unit != null) {
      Map<String, String> row = units.row(owner);
      if (!unit.equals(row.get(key))) row.put(key, unit);
    }
  }
  Object getData(String owner, String key) {
    checkAccess(); key(key);
    Map<String, Object> row = data.rows.get(name(owner));
    return row == null ? null : row.get(key);
  }
  Map<String, Map<String, Object>> data() { checkAccess(); return data.view; }
  String units(String owner, String key) {
    checkAccess(); Map<String, String> row = units.rows.get(name(owner));
    return row == null ? "" : row.getOrDefault(key, "");
  }
  Map<String, Object> flatData() {
    checkAccess(); Map<String, Object> flat = new HashMap<>();
    data.rows.forEach((owner, row) -> row.forEach((key, value) -> {
      flat.put(owner + "/" + key, value);
      if (owner.equals("Robot")) flat.put(key, value);
    }));
    return Collections.unmodifiableMap(flat);
  }
  private Groups<Object> variables(boolean command) { return command ? commandVariables : subsystemVariables; }
  Object variable(boolean command, String owner, String key, Object fallback) {
    checkAccess(); owner = name(owner); key(key);
    Groups<Object> group = variables(command);
    Map<String, Object> row = group.row(owner);
    if (!row.containsKey(key)) { row.put(key, fallback); group.revision++; }
    Object value = row.get(key);
    return value == null ? fallback : value;
  }
  void updateVariable(boolean command, String owner, String key, Object value) {
    checkAccess(); owner = name(owner); key(key);
    Groups<Object> group = variables(command);
    Map<String, Object> row = group.row(owner);
    if (!row.containsKey(key)) group.revision++;
    row.put(key, value);
  }
  Map<String, Map<String, Object>> variablesView(boolean command) { checkAccess(); return variables(command).view; }
  long revision(boolean command) { checkAccess(); return variables(command).revision; }
  void tuningEnabled(boolean enabled) { checkAccess(); tuningEnabled = enabled; }
  boolean tuningEnabled() { checkAccess(); return tuningEnabled; }
}
