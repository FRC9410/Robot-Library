package frc.robot.constants;

public class OIConstants {
  public static final int DRIVER_CONTROLLER_PORT = 0;
  public static final int OPERATOR_CONTROLLER_PORT = 1;
  public static final double DEADBAND = 0.05;

  /** Scales max drive/strafe speed from joystick (0 = stop, 1 = full speed). */
  public static final double MAX_SPEED_COEFFICIENT = 0.75;

  /** Linear speed coefficient when driving in reduced-speed zones. */
  public static final double REDUCED_SPEED_COEFFICIENT = 0.5;
}
