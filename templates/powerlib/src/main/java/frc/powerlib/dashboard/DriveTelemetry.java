package frc.powerlib.dashboard;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotController;
import frc.powerlib.PowerRobotContainer;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;

/** Collects Drive subsystem data before SubsystemTelemetry publishes and logs it. */
public final class DriveTelemetry {
  private Supplier<Pose2d> poseSupplier;
  private Supplier<ChassisSpeeds> speedsSupplier;
  private Supplier<String> stateSupplier;
  private BooleanSupplier gyroConnectedSupplier;
  private final Map<String, BooleanSupplier> moduleConnectedSuppliers = new LinkedHashMap<>();
  private long heartbeat;
  private int driverControllerPort;

  /** Use the same Driver Station joystick port as the team's driver controller. */
  public DriveTelemetry withDriverControllerPort(int port) {
    if (port < 0 || port >= DriverStation.kJoystickPorts) {
      throw new IllegalArgumentException("Driver controller port must be between 0 and 5.");
    }
    driverControllerPort = port;
    return this;
  }

  public DriveTelemetry withPose(Supplier<Pose2d> supplier) {
    poseSupplier = supplier;
    return this;
  }

  public DriveTelemetry withSpeeds(Supplier<ChassisSpeeds> supplier) {
    speedsSupplier = supplier;
    return this;
  }

  public DriveTelemetry withState(Supplier<String> supplier) {
    stateSupplier = supplier;
    return this;
  }

  /** Supply actual gyro communication health; omitted sensors are not assumed healthy. */
  public DriveTelemetry withGyroConnected(BooleanSupplier supplier) {
    gyroConnectedSupplier = Objects.requireNonNull(supplier);
    return this;
  }

  /** Supply actual module communication health (for example FL, FR, BL, BR). */
  public DriveTelemetry withModuleConnected(String name, BooleanSupplier supplier) {
    if (name == null || name.isBlank() || name.contains("/")) {
      throw new IllegalArgumentException("Module name must be nonblank and cannot contain '/'.");
    }
    moduleConnectedSuppliers.put(name, Objects.requireNonNull(supplier));
    return this;
  }

  public void publish() {
    setData("Enabled", DriverStation.isEnabled());
    setData("Mode", DriverStation.isDisabled() ? "DISABLED"
        : DriverStation.isAutonomous() ? "AUTO" : DriverStation.isTest() ? "TEST" : "TELEOP");
    setData("DsAttached", DriverStation.isDSAttached());
    setData("FmsAttached", DriverStation.isFMSAttached());
    setData("Alliance", DriverStation.getAlliance().map(Enum::name).orElse("Unknown"));
    setData("MatchTimeSeconds", DriverStation.getMatchTime(), "seconds");
    setData("BatteryVolts", RobotController.getBatteryVoltage(), "volts");
    setData("BrownedOut", RobotController.isBrownedOut());
    setData("DriverControllerConnected", DriverStation.isJoystickConnected(driverControllerPort));
    setData("RioCanUtilization", RobotController.getCANStatus().percentBusUtilization);
    if (stateSupplier != null) setData("State", stateSupplier.get());
    if (gyroConnectedSupplier != null) setData("GyroConnected", gyroConnectedSupplier.getAsBoolean());
    moduleConnectedSuppliers.forEach((name, supplier) ->
        setData("Modules/" + name + "/Connected", supplier.getAsBoolean()));
    if (poseSupplier != null) {
      Pose2d pose = poseSupplier.get();
      boolean valid = pose != null && Double.isFinite(pose.getX()) && Double.isFinite(pose.getY())
          && Double.isFinite(pose.getRotation().getDegrees());
      setData("PoseValid", valid);
      if (valid) {
        setData("Pose/XMeters", pose.getX(), "meters");
        setData("Pose/YMeters", pose.getY(), "meters");
        setData("Pose/HeadingDegrees", pose.getRotation().getDegrees(), "degrees");
      }
    }
    if (speedsSupplier != null) {
      ChassisSpeeds speeds = speedsSupplier.get();
      boolean valid = speeds != null && Double.isFinite(speeds.vxMetersPerSecond)
          && Double.isFinite(speeds.vyMetersPerSecond) && Double.isFinite(speeds.omegaRadiansPerSecond);
      setData("SpeedsValid", valid);
      if (valid) {
        setData("Speeds/VXMetersPerSecond", speeds.vxMetersPerSecond, "meters per second");
        setData("Speeds/VYMetersPerSecond", speeds.vyMetersPerSecond, "meters per second");
        setData("Speeds/OmegaRadiansPerSecond", speeds.omegaRadiansPerSecond, "radians per second");
      }
    }
    // Changes even when the robot is stationary, so stale feedback cannot look healthy.
    setData("Heartbeat", (double) ++heartbeat);
  }

  private static void setData(String key, Object value) {
    PowerRobotContainer.setSubsystemData("Drive", key, value);
  }

  private static void setData(String key, Object value, String units) {
    PowerRobotContainer.setSubsystemData("Drive", key, value, units);
  }
}
