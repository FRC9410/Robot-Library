package frc.powerlib.auto;

import edu.wpi.first.networktables.NetworkTableEntry;
import edu.wpi.first.networktables.NetworkTableInstance;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/** A standard String Chooser whose selection and acknowledgement use NetworkTables directly. */
public final class NTChooser<T> implements AutoCloseable {
  private final Map<String, T> options = new LinkedHashMap<>();
  private final NetworkTableEntry typeEntry;
  private final NetworkTableEntry controllableEntry;
  private final NetworkTableEntry optionsEntry;
  private final NetworkTableEntry defaultEntry;
  private final NetworkTableEntry activeEntry;
  private final NetworkTableEntry selectedEntry;
  private String defaultName;
  private boolean published;

  public NTChooser(String tablePath) {
    if (tablePath == null || tablePath.isBlank()) {
      throw new IllegalArgumentException("Chooser table path must not be blank.");
    }
    var table = NetworkTableInstance.getDefault().getTable(tablePath);
    typeEntry = table.getEntry(".type");
    controllableEntry = table.getEntry(".controllable");
    optionsEntry = table.getEntry("options");
    defaultEntry = table.getEntry("default");
    activeEntry = table.getEntry("active");
    selectedEntry = table.getEntry("selected");
  }

  public void addOption(String name, T value) {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("Chooser option name must not be blank.");
    }
    options.put(name, value);
    if (published) publishOptions();
  }

  public void setDefaultOption(String name, T value) {
    addOption(name, value);
    defaultName = name;
    if (published) defaultEntry.setString(name);
  }

  /** Replace available options and resolve a preserved selection against the new list. */
  public void setOptions(Map<String, T> available, String defaultOption) {
    Objects.requireNonNull(available, "Chooser options must not be null.");
    if (!available.containsKey(defaultOption)) {
      throw new IllegalArgumentException("Chooser default must be an available option.");
    }
    available.forEach((name, value) -> {
      if (name == null || name.isBlank()) {
        throw new IllegalArgumentException("Chooser option name must not be blank.");
      }
      Objects.requireNonNull(value, "Chooser option must not be null.");
    });
    // Copy first so passing an existing options view cannot clear the source.
    Map<String, T> replacement = new LinkedHashMap<>(available);
    options.clear();
    options.putAll(replacement);
    defaultName = defaultOption;
    if (published) {
      publishOptions();
      defaultEntry.setString(defaultName);
      publishActive();
    }
  }

  /** Publish after configuring the default and options; preserve an existing dashboard selection. */
  public void publish() {
    if (defaultName == null) {
      throw new IllegalStateException("Set a default option before publishing the chooser.");
    }
    typeEntry.setString("String Chooser");
    controllableEntry.setBoolean(true);
    defaultEntry.setString(defaultName);
    publishOptions();
    selectedEntry.setDefaultString(defaultName);
    published = true;
    publishActive();
  }

  public String getSelectedName() {
    String selected = selectedEntry.getString(defaultName != null ? defaultName : "");
    return options.containsKey(selected) ? selected : defaultName;
  }

  public T get() {
    return options.get(getSelectedName());
  }

  /** Call periodically on the robot thread. Writes active only when its resolved value changes. */
  public void publishActive() {
    if (!published) return;
    String active = getSelectedName();
    if (!active.equals(activeEntry.getString(""))) activeEntry.setString(active);
  }

  private void publishOptions() {
    optionsEntry.setStringArray(options.keySet().toArray(String[]::new));
  }

  @Override
  public void close() {
    for (var entry : new NetworkTableEntry[]{typeEntry, controllableEntry, optionsEntry,
        defaultEntry, activeEntry, selectedEntry}) {
      entry.unpublish();
      entry.close();
    }
    published = false;
  }
}
