// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.powerlib;

import java.util.HashMap;
import java.util.Map;

/**
 * Contract for the shared data container used by subsystems. Implemented by {@link frc.robot.RobotContainer}.
 * Subsystems that participate in shared data must implement {@link frc.robot.subsystems.SharedDataSubsystem}.
 * <p>
 * Call {@link #setData(String, Object)}, {@link #getData(String)}, or {@link #getData(String, Object)}
 * statically: {@code PowerRobotContainer.setData(key, value)} and {@code PowerRobotContainer.getData(key)}.
 */
public interface PowerRobotContainer {

  /** Shared storage for subsystem data. Defined on the interface so the static API is guaranteed. */
  Map<String, Object> SUBSYSTEM_DATA = new HashMap<>();

  /**
   * Stores a value in the shared data container. Call from anywhere via {@code PowerRobotContainer.setData(key, value)}.
   *
   * @param key   key to associate with the value
   * @param value value to store (may be null)
   */
  static void setData(String key, Object value) {
    SUBSYSTEM_DATA.put(key, value);
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
}
