package frc.powerlib.dashboard;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotController;
import frc.powerlib.PowerRobotContainer;
import java.util.Objects;
import java.util.function.Supplier;

/** Collects Drive subsystem data before SubsystemTelemetry publishes and logs it. */
public final class DriveTelemetry {
  private Supplier<Pose2d> poseSupplier;
  private Supplier<Double> headingSetpointSupplier;
  private Supplier<String> stateSupplier;
  private Supplier<String> requestedStateSupplier;
  private Supplier<String> actualStateSupplier;
  private long heartbeat;

  public DriveTelemetry withPose(Supplier<Pose2d> supplier) {
    poseSupplier = supplier;
    return this;
  }

  public DriveTelemetry withState(Supplier<String> supplier) {
    stateSupplier = supplier;
    return this;
  }

  /** Driver or autonomous demand, independent of whether the robot can fulfill it. */
  public DriveTelemetry withRequestedState(Supplier<String> supplier) {
    requestedStateSupplier = Objects.requireNonNull(supplier);
    return this;
  }

  /** State derived by the robot controller from its current readiness and outputs. */
  public DriveTelemetry withActualState(Supplier<String> supplier) {
    actualStateSupplier = Objects.requireNonNull(supplier);
    return this;
  }

  /** Blue-origin field heading in degrees, or null when no heading target is active. */
  public DriveTelemetry withHeadingSetpoint(Supplier<Double> supplier) {
    headingSetpointSupplier = Objects.requireNonNull(supplier);
    return this;
  }

  public void publish() {
    setData("Enabled", DriverStation.isEnabled());
    setData("Mode", DriverStation.isDisabled() ? "DISABLED"
        : DriverStation.isAutonomous() ? "AUTO" : DriverStation.isTest() ? "TEST" : "TELEOP");
    setData("Alliance", DriverStation.getAlliance().map(Enum::name).orElse("Unknown"));
    setData("MatchTimeSeconds", DriverStation.getMatchTime(), "seconds");
    setData("BatteryVolts", RobotController.getBatteryVoltage(), "volts");
    setData("RioCanUtilization", RobotController.getCANStatus().percentBusUtilization);
    if (stateSupplier != null) setData("State", stateSupplier.get());
    if (requestedStateSupplier != null) setData("RequestedState", requestedStateSupplier.get());
    if (actualStateSupplier != null) setData("ActualState", actualStateSupplier.get());
    if (poseSupplier != null) {
      Pose2d pose = poseSupplier.get();
      boolean valid = pose != null && Double.isFinite(pose.getX()) && Double.isFinite(pose.getY())
          && Double.isFinite(pose.getRotation().getDegrees());
      setData("PoseValid", valid);
      setData("Pose", valid ? pose : null);
      if (valid) {
        setData("Pose/XMeters", pose.getX(), "meters");
        setData("Pose/YMeters", pose.getY(), "meters");
        setData("Pose/HeadingDegrees", pose.getRotation().getDegrees(), "degrees");
      } else {
        setData("Pose/XMeters", Double.NaN, "meters");
        setData("Pose/YMeters", Double.NaN, "meters");
        setData("Pose/HeadingDegrees", Double.NaN, "degrees");
      }
    }
    if (headingSetpointSupplier != null) {
      Double heading = headingSetpointSupplier.get();
      // An explicit nonfinite value clears the previous target without another status topic.
      setData("HeadingSetpointDegrees", heading != null && Double.isFinite(heading)
          ? heading : Double.NaN, "degrees");
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
