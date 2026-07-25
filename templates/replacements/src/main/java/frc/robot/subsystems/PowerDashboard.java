// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableEntry;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.PowerRobotContainer;
import java.util.HashMap;
import java.util.Map;

public class PowerDashboard extends SubsystemBase {
  private final StateMachine stateMachine;
  private final NetworkTable dataTable =
      NetworkTableInstance.getDefault().getTable("PowerLib").getSubTable("Data");
  private final NetworkTable characterizationTable =
      NetworkTableInstance.getDefault().getTable("PowerLib").getSubTable("Characterization");
  private final Map<String, CharacterizationCommandBinding> characterizationCommands = new HashMap<>();

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
    new java.util.HashMap<>(PowerRobotContainer.getAllData())
        .forEach(this::publishValue);
    pollCharacterizationCommands();
  }

  private void publishValue(String key, Object value) {
    NetworkTableEntry entry = dataTable.getEntry(key);
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
