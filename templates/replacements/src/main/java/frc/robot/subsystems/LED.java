// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.subsystems;

import com.ctre.phoenix6.controls.SolidColor;
import com.ctre.phoenix6.hardware.CANdle;
import com.ctre.phoenix6.signals.RGBWColor;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.powerlib.PowerRobotContainer;
import frc.robot.Constants;

/** Subsystem for controlling LEDs via a CTRE CANdle. */
public class LED extends SubsystemBase {
  private final CANdle candle = new CANdle(Constants.LED.CANDLE_CAN_ID, Constants.LED.CANDLE_CAN_BUS);
  private final int ledStartIndex = Constants.LED.STRIP_START_INDEX;
  private final int ledEndIndex = Constants.LED.STRIP_START_INDEX + Constants.LED.STRIP_LENGTH - 1;
  private LEDMode mode = LEDMode.OFF;

  public LED() {
    PowerRobotContainer.setData("ledColor", mode.name());
  }

  @Override
  public void periodic() {}

  public void updateColorMode() {
    PowerRobotContainer.setData("ledColor", mode.name());

    switch (mode) {
      case SOLID_GREEN:
        setSolid(0, 255, 0);
        break;
      case SOLID_BLUE:
        setSolid(0, 0, 255);
        break;
      case SOLID_RED:
        setSolid(255, 0, 0);
        break;
      case SOLID_PURPLE:
        setSolid(164, 94, 229);
        break;
      case SOLID_ORANGE:
        setSolid(231, 109, 44);
        break;
      case SOLID_YELLOW:
        setSolid(221, 214, 24);
        break;
      case ALLIANCE:
        if (DriverStation.getAlliance().isPresent()
            && DriverStation.getAlliance().get() == Alliance.Red) {
          setSolid(255, 0, 0);
        } else {
          setSolid(0, 0, 255);
        }
        break;
      case OFF:
      default:
        setSolid(0, 0, 0);
        break;
    }
  }

  private void setSolid(int r, int g, int b) {
    candle.setControl(
        new SolidColor(ledStartIndex, ledEndIndex)
            .withColor(new RGBWColor(r, g, b, 0)));
  }

  public void setMode(LEDMode mode) {
    this.mode = mode;
    updateColorMode();
  }

  public LEDMode getMode() {
    return mode;
  }

  public enum LEDMode {
    OFF,
    SOLID_GREEN,
    SOLID_BLUE,
    SOLID_RED,
    SOLID_PURPLE,
    SOLID_YELLOW,
    SOLID_ORANGE,
    ALLIANCE
  }
}

