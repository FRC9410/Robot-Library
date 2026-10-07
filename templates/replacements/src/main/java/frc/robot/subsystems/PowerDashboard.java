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
  private final frc.powerlib.dashboard.DriveTelemetry driveTelemetry;
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
  private long syncedSubsystemVariablesRevision = -1;
  private long syncedCommandVariablesRevision = -1;

  public PowerDashboard(StateMachine stateMachine) {
    this.stateMachine = stateMachine;
    driveTelemetry = new frc.powerlib.dashboard.DriveTelemetry()
        .withDriverControllerPort(frc.robot.Constants.OI.DRIVER_CONTROLLER_PORT)
        .withPose(() -> stateMachine.drivetrain.getState().Pose)
        .withSpeeds(() -> stateMachine.drivetrain.getState().Speeds)
        .withState(() -> stateMachine.getWantedState().name())
        .withGyroConnected(() -> stateMachine.drivetrain.getPigeon2().isConnected());
    // Matches TunerConstants.createDrivetrain's FL, FR, BL, BR module order.
    String[] moduleNames = {"FL", "FR", "BL", "BR"};
    for (int index = 0; index < stateMachine.drivetrain.getModules().length; index++) {
      var module = stateMachine.drivetrain.getModule(index);
      String name = index < moduleNames.length ? moduleNames[index] : "Module " + index;
      driveTelemetry.withModuleConnected(name, () -> module.getDriveMotor().isConnected()
          && module.getSteerMotor().isConnected() && module.getEncoder().isConnected());
    }
    frc.robot.constants.GeneratedTunableConstants.register();
    initCharacterizationRoutines();
  }

  private void initCharacterizationRoutines() {
    // POWERLIB GENERATED CHARACTERIZATION START - DO NOT DELETE
    // POWERLIB GENERATED CHARACTERIZATION END - DO NOT DELETE
  }

  @Override
  public void periodic() {
    driveTelemetry.publish();
    syncTuningMode();
    publishSubsystemData();
    syncSubsystemVariables();
    frc.powerlib.tuning.TunableConstants.sync();
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
    frc.powerlib.dashboard.SubsystemTelemetry.publish();
  }

  private void syncSubsystemVariables() {
    long revision = PowerRobotContainer.getSubsystemVariablesRevision();
    if (!PowerRobotContainer.isTuningEnabled() && revision == syncedSubsystemVariablesRevision) {
      return;
    }
    syncVariables(
        PowerRobotContainer.getAllSubsystemVariables(),
        subsystemsTable,
        PowerRobotContainer::updateSubsystemVariable);
    syncedSubsystemVariablesRevision = revision;
  }

  private void syncCommandVariables() {
    long revision = PowerRobotContainer.getCommandVariablesRevision();
    if (!PowerRobotContainer.isTuningEnabled() && revision == syncedCommandVariablesRevision) {
      return;
    }
    syncVariables(
        PowerRobotContainer.getAllCommandVariables(),
        commandsTable,
        PowerRobotContainer::updateCommandVariable);
    syncedCommandVariablesRevision = revision;
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
