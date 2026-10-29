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
import frc.powerlib.configs.LimelightHeadingConfig;
import frc.powerlib.health.HealthChecks;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.DoubleSupplier;

/**
 * MegaTag2 position and independent MegaTag1 heading readers, ranked by measurement quality.
 *
 * <p>Names are NetworkTables table names; their order breaks quality ties. Each update publishes robot orientation
 * to every camera and exposes fresh candidates for downstream validation and camera fallback.
 * Call update once per robot loop, even when pose corrections are disabled, to consume old frames.
 * Configure each camera's mounting pose and AprilTag pipeline in its own Limelight web UI.
 * This class owns its publishers/subscribers, but not the NetworkTableInstance. Use on one thread.
 */
public final class LimelightVision implements AutoCloseable {
  private static final double IGNORED_AXIS_STD_DEV = 99999999.0;
  private static final double MIN_POSITION_STD_DEV = 0.001;
  private static final double SINGLE_TAG_MAX_DISTANCE_METERS = 2;
  private static final double SINGLE_TAG_MAX_AMBIGUITY = .05;
  private static final double SINGLE_TAG_MAX_AGE_SECONDS = .1;
  private static final Comparator<Measurement> POSITION_QUALITY =
      Comparator.comparingDouble(Measurement::positionStdDev)
          .thenComparing(Comparator.comparingDouble(Measurement::timestampSeconds).reversed());
  private static final Comparator<HeadingMeasurement> HEADING_GEOMETRY =
      Comparator.comparingInt((HeadingMeasurement measurement) -> measurement.tagCount() >= 2 ? 0 : 1)
          .thenComparingDouble(measurement -> measurement.averageTagDistanceMeters()
              * measurement.averageTagDistanceMeters() / measurement.tagCount())
          .thenComparingDouble(HeadingMeasurement::maxTagAmbiguity)
          .thenComparing(Comparator.comparingDouble(HeadingMeasurement::tagSpan).reversed());
  private static final Comparator<HeadingMeasurement> HEADING_QUALITY = HEADING_GEOMETRY
      .thenComparing(Comparator.comparingDouble(HeadingMeasurement::timestampSeconds).reversed());

  /** Timestamp is latency-corrected, in the FPGA/NetworkTables local clock domain (seconds). */
  public record Measurement(
      String cameraName,
      Pose2d pose,
      double timestampSeconds,
      int tagCount,
      double averageTagDistanceMeters,
      double positionStdDev,
      double heightMeters) {
    /** Compatibility for callers that already hold a planar measurement. */
    public Measurement(String cameraName, Pose2d pose, double timestampSeconds, int tagCount,
        double averageTagDistanceMeters, double positionStdDev) {
      this(cameraName, pose, timestampSeconds, tagCount, averageTagDistanceMeters, positionStdDev, 0);
    }
    /** Vision corrects translation; the very large heading uncertainty preserves gyro heading. */
    public Matrix<N3, N1> standardDeviations() {
      return VecBuilder.fill(positionStdDev, positionStdDev, IGNORED_AXIS_STD_DEV);
    }
  }

  /** Independent camera heading. Timestamp uses the same FPGA clock domain as Measurement. */
  public record HeadingMeasurement(
      String cameraName, Pose2d pose, double timestampSeconds, double headingStdDevRadians, int tagCount,
      double averageTagDistanceMeters, double maxTagAmbiguity, double tagSpan) {
    public HeadingMeasurement(String cameraName, Pose2d pose, double timestampSeconds,
        double headingStdDevRadians, int tagCount) {
      this(cameraName, pose, timestampSeconds, headingStdDevRadians, tagCount,
          Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, 0);
    }
    public HeadingMeasurement(String cameraName, Pose2d pose, double timestampSeconds, double headingStdDevRadians) {
      this(cameraName, pose, timestampSeconds, headingStdDevRadians, 1);
    }
    /** Ignore MegaTag1 X/Y: only its heading should influence the estimator. */
    public Matrix<N3, N1> standardDeviations() {
      return VecBuilder.fill(IGNORED_AXIS_STD_DEV, IGNORED_AXIS_STD_DEV, headingStdDevRadians);
    }

    /** Single-tag recovery needs explicit, close, low-ambiguity evidence; unknown quality is insufficient. */
    public boolean reliableSingleTag(double now) {
      return tagCount == 1 && averageTagDistanceMeters > 0
          && averageTagDistanceMeters <= SINGLE_TAG_MAX_DISTANCE_METERS
          && Double.isFinite(maxTagAmbiguity) && maxTagAmbiguity >= 0
          && maxTagAmbiguity <= SINGLE_TAG_MAX_AMBIGUITY
          && HealthChecks.isFresh(now - timestampSeconds, SINGLE_TAG_MAX_AGE_SECONDS + 1e-9);
    }

    /** Freshness breaks frame ties, but is not stronger evidence for changing cameras. */
    public boolean higherQualityThan(HeadingMeasurement other) {
      return HEADING_GEOMETRY.compare(this, other) < 0;
    }

    /** Capture-time heading difference, or NaN if either pose is invalid. */
    public double errorDegrees(Pose2d historicalPose) {
      return HealthChecks.finitePose(pose) && HealthChecks.finitePose(historicalPose)
          ? pose.getRotation().minus(historicalPose.getRotation()).getDegrees() : Double.NaN;
    }

    public static boolean isErrorAllowed(double errorDegrees, double maxErrorDegrees) {
      // Allow floating-point roundoff at the configured boundary.
      return Double.isFinite(errorDegrees) && Double.isFinite(maxErrorDegrees)
          && maxErrorDegrees > 0 && maxErrorDegrees <= 180
          && Math.abs(errorDegrees) <= maxErrorDegrees + 1e-9;
    }

    /** Compare at capture time; reuse historical X/Y to avoid translation/rotation coupling. */
    public Optional<Pose2d> correctionPose(Pose2d historicalPose, double maxErrorDegrees) {
      if (!isErrorAllowed(errorDegrees(historicalPose), maxErrorDegrees)) return Optional.empty();
      return Optional.of(new Pose2d(historicalPose.getTranslation(), pose.getRotation()));
    }

    /** Move the capture-time heading error forward without undoing newer position corrections. */
    public Optional<Pose2d> correctionPose(Pose2d historicalPose, Pose2d fusionPose,
        double maxErrorDegrees) {
      if (!HealthChecks.finitePose(fusionPose)
          || !isErrorAllowed(errorDegrees(historicalPose), maxErrorDegrees)) return Optional.empty();
      var error = pose.getRotation().minus(historicalPose.getRotation());
      return Optional.of(new Pose2d(fusionPose.getTranslation(), fusionPose.getRotation().plus(error)));
    }
  }

  private static final class Camera implements AutoCloseable {
    final String name;
    final DoubleArrayPublisher orientation;
    final DoubleArraySubscriber pose;
    final DoubleArraySubscriber headingPose;
    final DoublePublisher imuMode;
    final DoublePublisher imuAssist;
    final DoublePublisher throttle;
    long lastSeenTimestamp;
    long lastHeadingTimestamp;

    Camera(NetworkTableInstance nt, String name) {
      this.name = name;
      var table = nt.getTable(name);
      orientation = table.getDoubleArrayTopic("robot_orientation_set").publish();
      pose = table.getDoubleArrayTopic("botpose_orb_wpiblue").subscribe(
          new double[0], PubSubOption.keepDuplicates(true), PubSubOption.periodic(0.02));
      headingPose = table.getDoubleArrayTopic("botpose_wpiblue").subscribe(
          new double[0], PubSubOption.keepDuplicates(true), PubSubOption.periodic(0.02));
      imuMode = table.getDoubleTopic("imumode_set").publish();
      imuAssist = table.getDoubleTopic("imuassistalpha_set").publish();
      throttle = table.getDoubleTopic("throttle_set").publish();
    }

    @Override
    public void close() {
      orientation.close();
      pose.close();
      headingPose.close();
      imuMode.close();
      imuAssist.close();
      throttle.close();
    }
  }

  private final NetworkTableInstance nt;
  private final LimelightVisionConfig config;
  private final LimelightHeadingConfig headingConfig;
  private final DoubleSupplier clockSeconds;
  private final List<Camera> cameras = new ArrayList<>();
  private final double[] orientation = new double[6];
  private double measurementStdDevScale = 1.0;
  private Boolean throttled;
  private boolean closed;
  private final List<HeadingMeasurement> headingMeasurements = new ArrayList<>();
  private final List<HeadingMeasurement> headingView = Collections.unmodifiableList(headingMeasurements);
  private final List<Measurement> positionMeasurements = new ArrayList<>();
  private final List<Measurement> positionView = Collections.unmodifiableList(positionMeasurements);

  public LimelightVision(String... cameraNames) {
    this(LimelightVisionConfig.DEFAULT, cameraNames);
  }

  public LimelightVision(LimelightVisionConfig config, String... cameraNames) {
    this(NetworkTableInstance.getDefault(), config, cameraNames);
  }

  public LimelightVision(
      LimelightVisionConfig config, LimelightHeadingConfig headingConfig, String... cameraNames) {
    this(NetworkTableInstance.getDefault(), config, headingConfig, cameraNames);
  }

  public LimelightVision(
      NetworkTableInstance nt, LimelightVisionConfig config, String... cameraNames) {
    this(nt, config, LimelightHeadingConfig.DEFAULT, cameraNames);
  }

  public LimelightVision(NetworkTableInstance nt, LimelightVisionConfig config,
      LimelightHeadingConfig headingConfig, String... cameraNames) {
    this(nt, config, headingConfig, () -> WPIUtilJNI.now() / 1000000.0, cameraNames);
  }

  LimelightVision(
      NetworkTableInstance nt,
      LimelightVisionConfig config,
      LimelightHeadingConfig headingConfig,
      DoubleSupplier clockSeconds,
      String... cameraNames) {
    this.nt = Objects.requireNonNull(nt, "nt");
    this.config = Objects.requireNonNull(config, "config");
    this.headingConfig = Objects.requireNonNull(headingConfig, "headingConfig");
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

  /** Compatibility position-only update. Use the four-argument overload to enable heading reads. */
  public Optional<Measurement> update(double yawDegrees, double pitchDegrees, double rollDegrees) {
    return update(yawDegrees, pitchDegrees, rollDegrees, Double.NaN);
  }

  /** Rates are degrees/second. Read getHeadingMeasurement() after this update. */
  public Optional<Measurement> update(
      double yawDegrees, double pitchDegrees, double rollDegrees, double yawRateDegreesPerSecond) {
    return update(yawDegrees, pitchDegrees, rollDegrees, yawRateDegreesPerSecond, false);
  }

  /** Permit single-tag candidates for stationary initialization/recovery; multi-tag frames still win. */
  public Optional<Measurement> update(double yawDegrees, double pitchDegrees, double rollDegrees,
      double yawRateDegreesPerSecond, boolean allowSingleTagHeading) {
    ensureOpen();
    headingMeasurements.clear();
    positionMeasurements.clear();
    boolean validOrientation = Double.isFinite(yawDegrees) && Double.isFinite(pitchDegrees)
        && Double.isFinite(rollDegrees);
    boolean canUseHeading = validOrientation && Double.isFinite(yawRateDegreesPerSecond)
        && Math.abs(yawRateDegreesPerSecond) <= headingConfig.maxYawRateDegreesPerSecond();
    if (validOrientation) {
      orientation[0] = yawDegrees;
      orientation[1] = Double.isFinite(yawRateDegreesPerSecond) ? yawRateDegreesPerSecond : 0;
      orientation[2] = pitchDegrees;
      orientation[4] = rollDegrees;
      for (Camera camera : cameras) camera.orientation.set(orientation);
      if (!cameras.isEmpty()) nt.flush();
    }

    double now = clockSeconds.getAsDouble();
    for (Camera camera : cameras) {
      TimestampedDoubleArray frame = camera.pose.getAtomic();
      if (frame.timestamp > camera.lastSeenTimestamp) {
        // Consume skipped/rejected frames too; never replay them after enabling or slowing down.
        camera.lastSeenTimestamp = frame.timestamp;
        if (validOrientation) {
          var candidate = parseMeasurement(camera.name, frame, now);
          if (candidate != null) positionMeasurements.add(candidate);
        }
      }
      TimestampedDoubleArray headingFrame = camera.headingPose.getAtomic();
      if (headingFrame.timestamp > camera.lastHeadingTimestamp) {
        camera.lastHeadingTimestamp = headingFrame.timestamp;
        if (canUseHeading) {
          var candidate = parseHeadingMeasurement(camera.name, headingFrame, now, allowSingleTagHeading);
          if (candidate != null) {
            headingMeasurements.add(candidate);
          }
        }
      }
    }
    // Stable sorting keeps configured camera order as the final tie-breaker.
    positionMeasurements.sort(POSITION_QUALITY);
    headingMeasurements.sort(HEADING_QUALITY);
    return positionMeasurements.stream().findFirst();
  }

  /** Fresh positions, lowest uncertainty first; this view changes on the next update. */
  public List<Measurement> getPositionMeasurements() {
    ensureOpen();
    return positionView;
  }

  /** Fresh headings ranked by tag count/distance, ambiguity, span and age; multi-tag beats single-tag. */
  public List<HeadingMeasurement> getHeadingMeasurements() {
    ensureOpen();
    return headingView;
  }

  /** Compatibility accessor for the first candidate, before downstream validation. */
  public Optional<HeadingMeasurement> getHeadingMeasurement() {
    ensureOpen();
    return headingMeasurements.stream().findFirst();
  }

  private HeadingMeasurement parseHeadingMeasurement(String name, TimestampedDoubleArray frame,
      double now, boolean allowSingleTagHeading) {
    Measurement measurement = parseMeasurement(name, frame, now);
    if (measurement == null || (!allowSingleTagHeading && measurement.tagCount() < 2)
        || frame.value[8] < 0 || (measurement.tagCount() >= 2 && frame.value[8] == 0)
        || measurement.averageTagDistanceMeters() > headingConfig.maxTagDistanceMeters()
        || now - measurement.timestampSeconds() > headingConfig.maxMeasurementAgeSeconds()) return null;
    double[] values = frame.value;
    double maxDistance = measurement.tagCount() == 1
        ? Math.min(headingConfig.maxTagDistanceMeters(), SINGLE_TAG_MAX_DISTANCE_METERS)
        : headingConfig.maxTagDistanceMeters();
    double maxAmbiguity = 0;
    for (int i = 11; i < values.length; i += 7) {
      double id = values[i], ambiguity = values[i + 6];
      if (id <= 0 || id != Math.rint(id) || values[i + 4] < 0
          || values[i + 4] > maxDistance
          || ambiguity < 0 || ambiguity > headingConfig.maxTagAmbiguity()) return null;
      maxAmbiguity = Math.max(maxAmbiguity, ambiguity);
      for (int previous = 11; previous < i; previous += 7) if (values[previous] == id) return null;
    }
    var heading = new HeadingMeasurement(name, measurement.pose(), measurement.timestampSeconds(),
        headingConfig.headingStdDevRadians(), measurement.tagCount(), measurement.averageTagDistanceMeters(),
        maxAmbiguity, values[8]);
    return measurement.tagCount() > 1 || heading.reliableSingleTag(now) ? heading : null;
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
        timestamp, count, values[9], stdDev, values[2]);
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
