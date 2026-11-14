package frc.robot.constants;

import frc.powerlib.configs.LimelightVisionConfig;
import frc.powerlib.configs.LimelightHeadingConfig;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.configs.VisionPoseFilterConfig;

public class VisionConstants {
  public static final double LIMELIGHT_FOV_DEGREES = 60.0;
  public static final int LIMELIGHT_IMAGE_WIDTH = 320;
  public static final int LIMELIGHT_IMAGE_HEIGHT = 240;
  public static final String LIMELIGHT_NAME = "limelight-main";
  // Measurements are ranked by quality; camera order breaks ties. Empty means no Limelights.
  // Example: {"limelight-b", "limelight-l", "limelight-r"}
  public static final String[] LIMELIGHT_NAMES = {LIMELIGHT_NAME};
  public static final boolean LIMELIGHT_IMU_ASSIST_ENABLED = true;
  // POWERLIB LOCALIZATION CONSTANTS START - DO NOT DELETE
  public static final double POSITION_TARGET_AREA_THRESHOLD = 0.0;
  public static final double POSITION_MAX_TARGET_DISTANCE_METERS = 6.25;
  public static final double HEADING_MAX_TAG_DISTANCE_METERS = 4.0;
  public static final double HEADING_SINGLE_TAG_MAX_DISTANCE_METERS = 2.0;
  // POWERLIB LOCALIZATION CONSTANTS END - DO NOT DELETE
  public static final LimelightVisionConfig CONFIG = LimelightVisionConfig.DEFAULT.withPositionLimits(
      POSITION_MAX_TARGET_DISTANCE_METERS, POSITION_TARGET_AREA_THRESHOLD);
  public static final LimelightHeadingConfig HEADING_CONFIG = LimelightHeadingConfig.DEFAULT.withDistanceLimits(
      HEADING_MAX_TAG_DISTANCE_METERS, HEADING_SINGLE_TAG_MAX_DISTANCE_METERS);
  public static final VisionPoseFilterConfig POSE_FILTER_CONFIG = VisionPoseFilterConfig.forField(
      LocationConstants.X_MIN, LocationConstants.X_MAX, LocationConstants.Y_MIN, LocationConstants.Y_MAX);
  // Enabled by default; use DEFAULT.withEnabled(false) to disable before robot startup.
  public static final VisionHeadingInitializationConfig HEADING_INITIALIZATION_CONFIG =
      VisionHeadingInitializationConfig.DEFAULT;

  // POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE
  // POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE
}
