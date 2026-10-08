package frc.powerlib.dashboard;

import com.ctre.phoenix6.SignalLogger;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.Timer;
import frc.powerlib.PowerRobotContainer;
import java.util.HashMap;

/** Publishes one snapshot of subsystem data to NetworkTables and the Phoenix signal logger. */
public final class SubsystemTelemetry {
  private static final NetworkTable SUBSYSTEMS =
      NetworkTableInstance.getDefault().getTable("PowerLib/Subsystems");

  private static final double PUBLISH_INTERVAL_SECONDS = 0.1;
  private static double lastPublishTimeSeconds = Double.NEGATIVE_INFINITY;

  private SubsystemTelemetry() {}

  /** Call every robot loop; telemetry and signal logging are sampled every 100 ms. */
  public static void publish() {
    publish(Timer.getFPGATimestamp());
  }

  static void publish(double nowSeconds) {
    if (nowSeconds >= lastPublishTimeSeconds
        && nowSeconds - lastPublishTimeSeconds + 1e-9 < PUBLISH_INTERVAL_SECONDS) {
      return;
    }
    // Send immediately after a simulation clock reset; never replay missed samples.
    lastPublishTimeSeconds = nowSeconds;
    new HashMap<>(PowerRobotContainer.getAllSubsystemData()).forEach((subsystem, values) -> {
      NetworkTable table = SUBSYSTEMS.getSubTable(subsystem).getSubTable("Data");
      new HashMap<>(values).forEach((key, value) -> {
        var entry = table.getEntry(key);
        String logName = "PowerLib/Subsystems/" + subsystem + "/Data/" + key;
        if (value instanceof Boolean flag) {
          entry.setBoolean(flag);
          SignalLogger.writeBoolean(logName, flag);
        } else if (value instanceof Number number) {
          double numeric = number.doubleValue();
          entry.setDouble(numeric);
          SignalLogger.writeDouble(logName, numeric,
              PowerRobotContainer.getSubsystemDataUnits(subsystem, key));
        } else {
          String text = value == null ? "" : value.toString();
          entry.setString(text);
          SignalLogger.writeString(logName, text);
        }
      });
    });
  }
}
