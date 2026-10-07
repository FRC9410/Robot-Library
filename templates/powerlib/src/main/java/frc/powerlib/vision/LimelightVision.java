package frc.powerlib.vision;

import edu.wpi.first.math.Matrix;
import edu.wpi.first.math.VecBuilder;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.numbers.N1;
import edu.wpi.first.math.numbers.N3;
import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoubleArraySubscriber;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.PubSubOption;
import edu.wpi.first.networktables.TimestampedDoubleArray;
import edu.wpi.first.util.WPIUtilJNI;
import frc.powerlib.configs.LimelightVisionConfig;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.DoubleSupplier;

/**
 * Reusable MegaTag2 reader for cameras configured in priority order.
 *
 * <p>Names are NetworkTables table names, in priority order. Each update publishes robot orientation
 * to every camera and returns at most one fresh measurement in blue-origin field coordinates.
 * Call update once per robot loop, even when pose corrections are disabled, to consume old frames.
 * Configure each camera's mounting pose and AprilTag pipeline in its own Limelight web UI.
 * This class owns its publishers/subscribers, but not the NetworkTableInstance. Use on one thread.
 */
public final class LimelightVision implements AutoCloseable {
  private static final double HEADING_STD_DEV = 99999999.0;
  private static final double MIN_POSITION_STD_DEV = 0.001;

  /** Timestamp is latency-corrected, in the FPGA/NetworkTables local clock domain (seconds). */
  public record Measurement(
      String cameraName,
      Pose2d pose,
      double timestampSeconds,
      int tagCount,
      double averageTagDistanceMeters,
      double positionStdDev) {
    /** Vision corrects translation; the very large heading uncertainty preserves gyro heading. */
    public Matrix<N3, N1> standardDeviations() {
      return VecBuilder.fill(positionStdDev, positionStdDev, HEADING_STD_DEV);
    }
  }

  private static final class Camera implements AutoCloseable {
    final String name;
    final DoubleArrayPublisher orientation;
    final DoubleArraySubscriber pose;
    final DoublePublisher imuMode;
    final DoublePublisher imuAssist;
    final DoublePublisher throttle;
    long lastSeenTimestamp;

    Camera(NetworkTableInstance nt, String name) {
      this.name = name;
      var table = nt.getTable(name);
      orientation = table.getDoubleArrayTopic("robot_orientation_set").publish();
      pose = table.getDoubleArrayTopic("botpose_orb_wpiblue").subscribe(
          new double[0], PubSubOption.keepDuplicates(true), PubSubOption.periodic(0.02));
      imuMode = table.getDoubleTopic("imumode_set").publish();
      imuAssist = table.getDoubleTopic("imuassistalpha_set").publish();
      throttle = table.getDoubleTopic("throttle_set").publish();
    }

    @Override
    public void close() {
      orientation.close();
      pose.close();
      imuMode.close();
      imuAssist.close();
      throttle.close();
    }
  }

  private final NetworkTableInstance nt;
  private final LimelightVisionConfig config;
  private final DoubleSupplier clockSeconds;
  private final List<Camera> cameras = new ArrayList<>();
  private final double[] orientation = new double[6];
  private double measurementStdDevScale = 1.0;
  private Boolean throttled;
  private boolean closed;

  public LimelightVision(String... cameraNames) {
    this(LimelightVisionConfig.DEFAULT, cameraNames);
  }

  public LimelightVision(LimelightVisionConfig config, String... cameraNames) {
    this(NetworkTableInstance.getDefault(), config, cameraNames);
  }

  public LimelightVision(
      NetworkTableInstance nt, LimelightVisionConfig config, String... cameraNames) {
    this(nt, config, () -> WPIUtilJNI.now() / 1000000.0, cameraNames);
  }

  private LimelightVision(
      NetworkTableInstance nt,
      LimelightVisionConfig config,
      DoubleSupplier clockSeconds,
      String... cameraNames) {
    this.nt = Objects.requireNonNull(nt, "nt");
    this.config = Objects.requireNonNull(config, "config");
    this.clockSeconds = Objects.requireNonNull(clockSeconds, "clockSeconds");
    Objects.requireNonNull(cameraNames, "cameraNames");
    var names = new HashSet<String>();
    for (String name : cameraNames) {
      if (name == null || name.isBlank() || name.contains("/")
          || name.chars().anyMatch(Character::isWhitespace) || !names.add(name)) {
        throw new IllegalArgumentException("Camera names must be unique table names without whitespace or slashes");
      }
    }
    for (String name : cameraNames) {
      cameras.add(new Camera(nt, name));
    }
    setIMUMode(0); // Use the robot's external orientation.
    setIMUAssistAlpha(0.03);
  }

  /** Array order is camera priority. Orientation rates are sent as zero. */
  public Optional<Measurement> update(double yawDegrees, double pitchDegrees, double rollDegrees) {
    ensureOpen();
    if (!Double.isFinite(yawDegrees) || !Double.isFinite(pitchDegrees)
        || !Double.isFinite(rollDegrees)) {
      return Optional.empty();
    }
    orientation[0] = yawDegrees;
    orientation[2] = pitchDegrees;
    orientation[4] = rollDegrees;
    for (Camera camera : cameras) {
      camera.orientation.set(orientation);
    }
    if (!cameras.isEmpty()) {
      nt.flush();
    }

    double now = clockSeconds.getAsDouble();
    Measurement selected = null;
    for (Camera camera : cameras) {
      TimestampedDoubleArray frame = camera.pose.getAtomic();
      if (frame.timestamp <= camera.lastSeenTimestamp) {
        continue;
      }
      // Consume all cameras' current frames, including those skipped because of priority.
      // This prevents an older lower-priority frame from being replayed on the next loop.
      camera.lastSeenTimestamp = frame.timestamp;
      if (selected == null) {
        selected = parseMeasurement(camera.name, frame, now);
      }
    }
    return Optional.ofNullable(selected);
  }

  private Measurement parseMeasurement(String name, TimestampedDoubleArray frame, double now) {
    double[] values = frame.value;
    if (values.length < 11 || (values.length - 11) % 7 != 0) {
      return null;
    }
    for (double value : values) {
      if (!Double.isFinite(value)) {
        return null;
      }
    }
    // Pose header has 11 values followed by seven values per raw fiducial.
    int count = (values.length - 11) / 7;
    if (count == 0 || values[7] != count || values[6] < 0.0
        || values[9] < 0.0 || values[9] >= config.maxTagDistanceMeters()) {
      return null;
    }
    double timestamp = frame.timestamp / 1000000.0 - values[6] / 1000.0;
    double age = now - timestamp;
    if (!Double.isFinite(age) || age < 0.0 || age > config.maxMeasurementAgeSeconds()) {
      return null;
    }
    double stdDev = Math.max(MIN_POSITION_STD_DEV,
        config.basePositionStdDev() * values[9] * values[9] / count * measurementStdDevScale);
    if (!Double.isFinite(stdDev)) {
      return null;
    }
    return new Measurement(name,
        new Pose2d(values[0], values[1], Rotation2d.fromDegrees(values[5])),
        timestamp, count, values[9], stdDev);
  }

  /** Optional robot-specific adjustment, e.g. a value below one to trust vision more during slip. */
  public void setMeasurementStdDevScale(double scale) {
    ensureOpen();
    if (!Double.isFinite(scale) || scale <= 0.0) {
      throw new IllegalArgumentException("Measurement standard deviation scale must be finite and positive");
    }
    measurementStdDevScale = scale;
  }

  public void setIMUMode(int mode) {
    ensureOpen();
    if (mode < 0 || mode > 4) {
      throw new IllegalArgumentException("IMU mode must be between 0 and 4");
    }
    for (Camera camera : cameras) {
      camera.imuMode.set(mode);
    }
  }

  public void setIMUAssistAlpha(double alpha) {
    ensureOpen();
    if (!Double.isFinite(alpha) || alpha < 0.0 || alpha > 1.0) {
      throw new IllegalArgumentException("IMU assist alpha must be between 0 and 1");
    }
    for (Camera camera : cameras) {
      camera.imuAssist.set(alpha);
    }
  }

  /** Skip 100 frames between processed frames while throttled; process normally otherwise. */
  public void setThrottle(boolean throttle) {
    ensureOpen();
    if (throttled != null && throttled == throttle) {
      return;
    }
    for (Camera camera : cameras) {
      camera.throttle.set(throttle ? 100.0 : 0.0);
    }
    throttled = throttle;
  }

  private void ensureOpen() {
    if (closed) {
      throw new IllegalStateException("LimelightVision is closed");
    }
  }

  @Override
  public void close() {
    if (!closed) {
      cameras.forEach(Camera::close);
      closed = true;
    }
  }
}
