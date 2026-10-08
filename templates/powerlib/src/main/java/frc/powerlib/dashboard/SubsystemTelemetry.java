package frc.powerlib.dashboard;

import com.ctre.phoenix6.SignalLogger;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.PubSubOption;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.networktables.StructPublisher;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.Timer;
import frc.powerlib.PowerRobotContainer;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/** Logs the latest map every robot loop and publishes a complete JSON snapshot every 100 ms. */
public final class SubsystemTelemetry {
  private static final double PUBLISH_INTERVAL_SECONDS = 0.1;
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final StringPublisher DATA = NetworkTableInstance.getDefault()
      .getStringTopic("/PowerLib/Data").publishEx("json", "{}", PubSubOption.periodic(PUBLISH_INTERVAL_SECONDS));
  // AdvantageScope needs a typed pose topic. It is derived from the same map/frame, not
  // independently sampled, and is the only additional live telemetry topic from this writer.
  private static final StructPublisher<Pose2d> DRIVE_POSE = NetworkTableInstance.getDefault()
      .getStructTopic("/PowerLib/Subsystems/Drive/Data/Pose", Pose2d.struct)
      .publish(PubSubOption.periodic(PUBLISH_INTERVAL_SECONDS));
  private static double lastPublishTimeSeconds = Double.NEGATIVE_INFINITY;
  private static long sequence;
  private static final Map<String, Map<String, String>> logNames = new HashMap<>();

  private SubsystemTelemetry() {}

  /** Call every 20 ms robot loop: log at 50 Hz, publish NetworkTables snapshots at 10 Hz. */
  public static void publish() {
    publish(Timer.getFPGATimestamp());
  }

  static void publish(double nowSeconds) {
    publish(nowSeconds, SubsystemTelemetry::logData);
  }

  static void publish(double nowSeconds, Consumer<Map<String, Map<String, Object>>> logger) {
    // Read latest cached inputs every control loop; network throttling must not throttle logs.
    // Logging does not clone or JSON-serialize the map on the intervening loops.
    logger.accept(PowerRobotContainer.getAllSubsystemData());
    if (nowSeconds >= lastPublishTimeSeconds
        && nowSeconds - lastPublishTimeSeconds + 1e-9 < PUBLISH_INTERVAL_SECONDS) return;
    lastPublishTimeSeconds = nowSeconds;
    // The scheduler owns this map. encodeSnapshot normalizes it once into a complete frame.
    Map<String, Map<String, Object>> snapshot = PowerRobotContainer.getAllSubsystemData();
    Object pose = snapshot.getOrDefault("Drive", Map.of()).get("Pose");
    try {
      DATA.set(encodeSnapshot(snapshot, ++sequence, nowSeconds));
    } catch (JsonProcessingException exception) {
      DriverStation.reportError("PowerLib data snapshot serialization failed: " + exception.getMessage(), false);
      return;
    }
    if (pose instanceof Pose2d valid && validPose(valid)) DRIVE_POSE.set(valid);
  }

  private static void logData(Map<String, Map<String, Object>> data) {
    data.forEach((subsystem, values) -> values.forEach((key, value) -> {
      String logName = logName(subsystem, key);
      if (value instanceof Pose2d || ("Drive".equals(subsystem) && "Pose".equals(key))) {
        if (value instanceof Pose2d pose && validPose(pose)) {
          SignalLogger.writeStruct(logName, Pose2d.struct, pose);
        }
        return; // Do not fabricate or repeat pose history for invalid feedback.
      }
      if (value instanceof Boolean flag) {
        SignalLogger.writeBoolean(logName, flag);
      } else if (value instanceof Number number) {
        SignalLogger.writeDouble(logName, number.doubleValue(),
            PowerRobotContainer.getSubsystemDataUnits(subsystem, key));
      } else {
        SignalLogger.writeString(logName, value == null ? "" : value.toString());
      }
    }));
  }

  private static String logName(String subsystem, String key) {
    Map<String, String> names = logNames.get(subsystem);
    if (names == null) { names = new HashMap<>(); logNames.put(subsystem, names); }
    String name = names.get(key);
    if (name == null) {
      name = "PowerLib/Subsystems/" + subsystem + "/Data/" + key;
      names.put(key, name);
    }
    return name;
  }

  static String encodeSnapshot(Map<String, Map<String, Object>> snapshot, long sequence,
      double timestampSeconds) throws JsonProcessingException {
    Map<String, Map<String, Object>> data = new HashMap<>();
    snapshot.forEach((subsystem, values) -> {
      Map<String, Object> normalized = new HashMap<>();
      values.forEach((key, value) -> normalized.put(key, jsonValue(value)));
      data.put(subsystem, normalized);
    });
    return JSON.writeValueAsString(Map.of("schemaVersion", 1, "sequence", sequence,
        "timestampSeconds", timestampSeconds, "subsystems", data));
  }

  private static Object jsonValue(Object value) {
    if (value instanceof Pose2d pose) {
      return validPose(pose) ? Map.of("xMeters", pose.getX(), "yMeters", pose.getY(),
          "headingRadians", pose.getRotation().getRadians()) : null;
    }
    if (value instanceof Number number) {
      return Double.isFinite(number.doubleValue()) ? value : null;
    }
    if (value == null || value instanceof Boolean || value instanceof String) return value;
    return value.toString();
  }

  private static boolean validPose(Pose2d pose) {
    return Double.isFinite(pose.getX()) && Double.isFinite(pose.getY())
        && Double.isFinite(pose.getRotation().getRadians());
  }
}
