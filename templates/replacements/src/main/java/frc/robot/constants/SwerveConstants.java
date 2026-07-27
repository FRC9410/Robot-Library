package frc.robot.constants;

/**
 * PowerLib-owned swerve behavior constants.
 *
 * <p>Phoenix/Tuner X hardware constants stay in {@link TunerConstants}; these values are the driver
 * feel and heading-control defaults that Power Tool can live-tune and then save back to
 * powerlib-subsystems.json.
 */
public class SwerveConstants {
  public static final double DRIVER_MAX_SPEED_COEFFICIENT = 0.75;
  public static final double DRIVER_VELOCITY_SCALE = 0.95;
  public static final double DRIVER_MAX_ANGULAR_RATE_RADIANS_PER_SECOND = 9.42477796076938;
  public static final double DRIVER_JOYSTICK_DEADBAND = 0.1;
  public static final double DRIVER_SKEW_COMPENSATION = -0.03;

  public static final double REQUEST_MAX_ANGULAR_RATE_RADIANS_PER_SECOND = 4.71238898038469;
  public static final double REQUEST_TRANSLATION_DEADBAND_METERS_PER_SECOND = 0.572;
  public static final double REQUEST_ROTATIONAL_DEADBAND_RADIANS_PER_SECOND = 0.471238898038469;

  public static final double DRIVE_TO_POINT_MAX_ANGULAR_RATE_RADIANS_PER_SECOND =
      3.141592653589793;
  public static final double DRIVE_TO_POINT_MAX_SPEED_COEFFICIENT = 0.75;
  public static final double DRIVE_TO_POINT_SLOW_SPEED_COEFFICIENT = 0.1875;
  public static final double DRIVE_TO_POINT_STATIC_FRICTION_CONSTANT = 0.085;

  public static final double HEADING_KP = 7.0;
  public static final double HEADING_KI = 0.0;
  public static final double HEADING_KD = 0.0;
}
