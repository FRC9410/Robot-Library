package frc.robot.constants;

import frc.powerlib.configs.LimelightVisionConfig;

public class VisionConstants {
  public static final String LIMELIGHT_NAME = "limelight";
  // First fresh, valid camera wins. Use an empty array for robots without Limelights.
  // Example: {"limelight-b", "limelight-l", "limelight-r"}
  public static final String[] LIMELIGHT_NAMES = {LIMELIGHT_NAME};
  public static final LimelightVisionConfig CONFIG = LimelightVisionConfig.DEFAULT;
}
