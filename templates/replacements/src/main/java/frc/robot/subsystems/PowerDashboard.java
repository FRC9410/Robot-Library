// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableEntry;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.PowerRobotContainer;
import java.util.HashMap;
import java.util.Map;

public class PowerDashboard extends SubsystemBase {
  private static final double TUNING_MODE_SYNC_INTERVAL_SECONDS = 1.0;

  private final StateMachine stateMachine;
  private final NetworkTable subsystemsTable =
      NetworkTableInstance.getDefault().getTable("PowerLib").getSubTable("Subsystems");
  private final NetworkTable commandsTable =
      NetworkTableInstance.getDefault().getTable("PowerLib").getSubTable("Commands");
  private final NetworkTable tuningTable =
      NetworkTableInstance.getDefault().getTable("PowerLib").getSubTable("Tuning");
  private final NetworkTableEntry tuningEnabledEntry = tuningTable.getEntry("Enabled");
  private final NetworkTableEntry tuningRequestedEntry = tuningTable.getEntry("RequestedEnabled");
  private final NetworkTable characterizationTable =
      NetworkTableInstance.getDefault().getTable("PowerLib").getSubTable("Characterization");
  private final Map<String, CharacterizationCommandBinding> characterizationCommands = new HashMap<>();
  private double nextTuningModeSyncTime = 0.0;

  public PowerDashboard(StateMachine stateMachine) {
    this.stateMachine = stateMachine;
    initCharacterizationRoutines();
  }

  private void initCharacterizationRoutines() {
    // POWERLIB GENERATED CHARACTERIZATION START - DO NOT DELETE
    // POWERLIB GENERATED CHARACTERIZATION END - DO NOT DELETE
  }

  @Override
  public void periodic() {
    syncTuningMode();
    publishSubsystemData();
    syncSubsystemVariables();
    syncCommandVariables();
    pollCharacterizationCommands();
  }

  private void syncTuningMode() {
    double now = Timer.getFPGATimestamp();
    if (now < nextTuningModeSyncTime) {
      return;
    }

    nextTuningModeSyncTime = now + TUNING_MODE_SYNC_INTERVAL_SECONDS;
    boolean currentEnabled = PowerRobotContainer.isTuningEnabled();
    boolean requestedEnabled = tuningRequestedEntry.getBoolean(currentEnabled);
    PowerRobotContainer.setTuningEnabled(requestedEnabled);
    tuningEnabledEntry.setBoolean(requestedEnabled);
  }

  private void publishSubsystemData() {
    new java.util.HashMap<>(PowerRobotContainer.getAllSubsystemData())
        .forEach(
            (subsystemName, values) -> {
              NetworkTable dataTable = subsystemsTable.getSubTable(subsystemName).getSubTable("Data");
              new java.util.HashMap<>(values).forEach((key, value) -> publishValue(dataTable, key, value));
            });
  }

  private void syncSubsystemVariables() {
    syncVariables(
        PowerRobotContainer.getAllSubsystemVariables(),
        subsystemsTable,
        PowerRobotContainer::updateSubsystemVariable);
  }

  private void syncCommandVariables() {
    syncVariables(
        PowerRobotContainer.getAllCommandVariables(),
        commandsTable,
        PowerRobotContainer::updateCommandVariable);
  }

  private void syncVariables(
      Map<String, Map<String, Object>> variablesByOwner,
      NetworkTable ownerTable,
      VariableUpdater updater) {
    new java.util.HashMap<>(variablesByOwner)
        .forEach(
            (ownerName, variables) -> {
              NetworkTable variablesTable = ownerTable.getSubTable(ownerName).getSubTable("Variables");
              new java.util.HashMap<>(variables)
                  .forEach(
                      (key, defaultValue) -> {
                        Object value =
                            syncVariable(
                                variablesTable.getEntry(key),
                                defaultValue,
                                PowerRobotContainer.isTuningEnabled());
                        updater.update(ownerName, key, value);
                      });
            });
  }

  private Object syncVariable(NetworkTableEntry entry, Object defaultValue, boolean tuningEnabled) {
    if (defaultValue instanceof Boolean) {
      boolean fallback = (Boolean) defaultValue;
      if (!entry.exists()) {
        entry.setBoolean(fallback);
      }
      if (!tuningEnabled) {
        return fallback;
      }
      return entry.getBoolean(fallback);
    }

    if (defaultValue instanceof Number) {
      double fallback = ((Number) defaultValue).doubleValue();
      if (!entry.exists()) {
        entry.setDouble(fallback);
      }
      if (!tuningEnabled) {
        return fallback;
      }
      return entry.getDouble(fallback);
    }

    String fallback = defaultValue == null ? "" : defaultValue.toString();
    if (!entry.exists()) {
      entry.setString(fallback);
    }
    if (!tuningEnabled) {
      return fallback;
    }
    return entry.getString(fallback);
  }

  private void publishValue(NetworkTable table, String key, Object value) {
    NetworkTableEntry entry = table.getEntry(key);
    if (value instanceof Boolean) {
      entry.setBoolean((Boolean) value);
      return;
    }

    if (value instanceof Number) {
      entry.setDouble(((Number) value).doubleValue());
      return;
    }

    entry.setString(value == null ? "" : value.toString());
  }

  private interface VariableUpdater {
    void update(String ownerName, String key, Object value);
  }

  private void registerCharacterizationCommand(String subsystemName, String commandName, Command command) {
    NetworkTable commandTable = characterizationTable.getSubTable(subsystemName).getSubTable(commandName);
    NetworkTableEntry requestEntry = commandTable.getEntry("request");
    NetworkTableEntry runningEntry = commandTable.getEntry("running");

    commandTable.getEntry(".type").setString("PowerLibCommand");
    commandTable.getEntry("name").setString(commandName);
    requestEntry.setBoolean(false);
    runningEntry.setBoolean(false);
    characterizationCommands.put(
        subsystemName + "/" + commandName,
        new CharacterizationCommandBinding(command, requestEntry, runningEntry));
  }

  private void pollCharacterizationCommands() {
    CommandScheduler scheduler = CommandScheduler.getInstance();
    characterizationCommands.values().forEach(
        binding -> {
          if (binding.requestEntry.getBoolean(false)) {
            binding.requestEntry.setBoolean(false);
            if (!scheduler.isScheduled(binding.command)) {
              scheduler.schedule(binding.command);
            }
          }

          binding.runningEntry.setBoolean(scheduler.isScheduled(binding.command));
        });
  }

  private static class CharacterizationCommandBinding {
    private final Command command;
    private final NetworkTableEntry requestEntry;
    private final NetworkTableEntry runningEntry;

    private CharacterizationCommandBinding(
        Command command, NetworkTableEntry requestEntry, NetworkTableEntry runningEntry) {
      this.command = command;
      this.requestEntry = requestEntry;
      this.runningEntry = runningEntry;
    }
  }
}
