package frc.powerlib.dashboard;

import com.ctre.phoenix6.SignalLogger;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotController;
import java.util.Objects;
import java.util.function.Supplier;

/** Log-only robot status, independent of the shared dashboard data map. */
public final class RobotLogTelemetry {
  private static final String STATUS_PREFIX = "PowerLib/RobotStatus/";
  private Supplier<String> autonomousStatusSupplier;
  private Supplier<String> autonomousReasonSupplier;
  private int driverControllerPort;

  /** Driver Station port used by the team's driver controller. */
  public RobotLogTelemetry withDriverControllerPort(int port) {
    if (port < 0 || port >= DriverStation.kJoystickPorts) {
      throw new IllegalArgumentException("Driver controller port must be between 0 and 5.");
    }
    driverControllerPort = port;
    return this;
  }

  public RobotLogTelemetry withAutonomousStatus(Supplier<String> status, Supplier<String> reason) {
    autonomousStatusSupplier = Objects.requireNonNull(status);
    autonomousReasonSupplier = Objects.requireNonNull(reason);
    return this;
  }

  /** Call every 20 ms robot loop to log status at 50 Hz. */
  public void log() {
    SignalLogger.writeBoolean(STATUS_PREFIX + "DsAttached", DriverStation.isDSAttached());
    SignalLogger.writeBoolean(STATUS_PREFIX + "FmsAttached", DriverStation.isFMSAttached());
    SignalLogger.writeBoolean(STATUS_PREFIX + "DriverControllerConnected",
        DriverStation.isJoystickConnected(driverControllerPort));
    SignalLogger.writeBoolean(STATUS_PREFIX + "BrownedOut", RobotController.isBrownedOut());
    if (autonomousStatusSupplier != null) {
      SignalLogger.writeString(STATUS_PREFIX + "AutoStatus", Objects.toString(autonomousStatusSupplier.get(), ""));
      SignalLogger.writeString(STATUS_PREFIX + "AutoReason", Objects.toString(autonomousReasonSupplier.get(), ""));
    }
    // Alliance, match time and CAN utilization remain shared dashboard data and are already
    // logged by SubsystemTelemetry. Do not sample or write them a second time here.
  }
}
