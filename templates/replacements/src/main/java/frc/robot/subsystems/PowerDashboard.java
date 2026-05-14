// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj.RobotBase;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.PowerRobotContainer;
import frc.robot.simulation.PowerSimManager;

public class PowerDashboard extends SubsystemBase {
  private final StateMachine stateMachine;
  private final PowerSimManager powerSimManager;

  public PowerDashboard(StateMachine stateMachine) {
    this.stateMachine = stateMachine;
    this.powerSimManager = RobotBase.isSimulation() ? new PowerSimManager(stateMachine) : null;
    initCharacterizationRoutines();
  }

  private void initCharacterizationRoutines() {
    SmartDashboard.putData("PowerLib/PowerDashboard", this);
    // POWERLIB GENERATED CHARACTERIZATION START - DO NOT DELETE
    // POWERLIB GENERATED CHARACTERIZATION END - DO NOT DELETE
  }

  @Override
  public void periodic() {
    if (powerSimManager != null) {
      powerSimManager.periodic();
    }

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
