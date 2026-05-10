package frc.robot.utils;

import edu.wpi.first.math.geometry.Pose2d;

public class FieldUtils {
  public static enum GameZone {
    RED_ALLIANCE,
    NEUTRAL,
    BLUE_ALLIANCE
  }

  public static GameZone getZone(Pose2d pose) {
    return GameZone.NEUTRAL;
  }
}
