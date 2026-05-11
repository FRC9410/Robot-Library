// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.PowerRobotContainer;

public class PowerDashboard extends SubsystemBase {
  private final StateMachine stateMachine;

  public PowerDashboard(StateMachine stateMachine) {
    this.stateMachine = stateMachine;
    initCharacterizationRoutines();
  }

  private void initCharacterizationRoutines() {
    SmartDashboard.putData("PowerLib/PowerDashboard", this);
    // POWERLIB GENERATED CHARACTERIZATION START - DO NOT DELETE
    // POWERLIB GENERATED CHARACTERIZATION END - DO NOT DELETE
  }

  @Override
  public void periodic() {
    new java.util.HashMap<>(PowerRobotContainer.getAllData())
        .forEach((key, value) -> publishValue("PowerLib/Data/" + key, value));
  }

  private void publishValue(String key, Object value) {
    if (value instanceof Boolean) {
      SmartDashboard.putBoolean(key, (Boolean) value);
      return;
    }

    if (value instanceof Number) {
      SmartDashboard.putNumber(key, ((Number) value).doubleValue());
      return;
    }

    SmartDashboard.putString(key, value == null ? "" : value.toString());
  }
}
