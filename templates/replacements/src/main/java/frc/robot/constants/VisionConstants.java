package frc.robot.constants;

import frc.powerlib.configs.LimelightVisionConfig;
import frc.powerlib.configs.LimelightHeadingConfig;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.configs.VisionPoseFilterConfig;

public class VisionConstants {
  public static final String LIMELIGHT_NAME = "limelight";
  // First fresh, valid camera wins. Use an empty array for robots without Limelights.
  // Example: {"limelight-b", "limelight-l", "limelight-r"}
  public static final String[] LIMELIGHT_NAMES = {LIMELIGHT_NAME};
  public static final LimelightVisionConfig CONFIG = LimelightVisionConfig.DEFAULT;
  public static final LimelightHeadingConfig HEADING_CONFIG = LimelightHeadingConfig.DEFAULT;
  public static final VisionPoseFilterConfig POSE_FILTER_CONFIG = VisionPoseFilterConfig.forField(
      LocationConstants.X_MIN, LocationConstants.X_MAX, LocationConstants.Y_MIN, LocationConstants.Y_MAX);
  // Enabled by default; use DEFAULT.withEnabled(false) to disable before robot startup.
  public static final VisionHeadingInitializationConfig HEADING_INITIALIZATION_CONFIG =
      VisionHeadingInitializationConfig.DEFAULT;

  // POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE
  // POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE
}
