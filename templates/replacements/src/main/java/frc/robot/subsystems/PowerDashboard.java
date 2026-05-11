// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.SubsystemBase;

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
  public void periodic() {}
}
