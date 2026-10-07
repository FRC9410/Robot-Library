package frc.powerlib.dashboard;

import com.ctre.phoenix6.SignalLogger;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import frc.powerlib.PowerRobotContainer;
import java.util.HashMap;

/** Publishes one snapshot of subsystem data to NetworkTables and the Phoenix signal logger. */
public final class SubsystemTelemetry {
  private static final NetworkTable SUBSYSTEMS =
      NetworkTableInstance.getDefault().getTable("PowerLib/Subsystems");

  private SubsystemTelemetry() {}

  /** Call once per robot loop from PowerDashboard, after collecting drive telemetry. */
  public static void publish() {
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
