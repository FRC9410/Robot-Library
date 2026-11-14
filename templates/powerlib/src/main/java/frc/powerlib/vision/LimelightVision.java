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
import frc.powerlib.PowerRobotContainer;
import frc.powerlib.tuning.TuningCadence;
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
  public record ImuStatus(String cameraName, String state, double cameraYawDegrees, double headingErrorDegrees) {}

  /** Per-tag camera distance limits for qualifying a frame at each tag count. */
  public record TagDistanceLimits(double oneTagMeters, double twoTagMeters, double threeTagMeters) {
    public TagDistanceLimits {
      if (!Double.isFinite(threeTagMeters) || !(oneTagMeters > 0)
          || !(oneTagMeters <= twoTagMeters && twoTagMeters <= threeTagMeters)) {
        throw new IllegalArgumentException("Tag distance limits must be finite, positive and ascending");
      }
    }
  }

  private record TagGroup(int count, double averageDistanceMeters) {}

  private static final double IGNORED_AXIS_STD_DEV = 99999999.0;
  private static final double MIN_POSITION_STD_DEV = 0.001;
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
      double averageTagDistanceMeters, double maxTagAmbiguity, double tagSpan,
      double singleTagMaxDistanceMeters) {
    public HeadingMeasurement(String cameraName, Pose2d pose, double timestampSeconds,
        double headingStdDevRadians, int tagCount, double averageTagDistanceMeters,
        double maxTagAmbiguity, double tagSpan) {
      this(cameraName, pose, timestampSeconds, headingStdDevRadians, tagCount,
          averageTagDistanceMeters, maxTagAmbiguity, tagSpan,
          LimelightHeadingConfig.DEFAULT_SINGLE_TAG_MAX_DISTANCE_METERS);
    }
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
          && Double.isFinite(singleTagMaxDistanceMeters) && singleTagMaxDistanceMeters > 0
          && averageTagDistanceMeters <= singleTagMaxDistanceMeters
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
    LimelightImuSync imuSync;
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
      imuMode = table.getDoubleTopic("imumode_set").publish(PubSubOption.keepDuplicates(true));
      imuAssist = table.getDoubleTopic("imuassistalpha_set").publish();
      throttle = table.getDoubleTopic("throttle_set").publish();
    }

    @Override
    public void close() {
      if (imuSync != null) imuSync.close();
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
  private final TuningCadence tuningCadence = new TuningCadence();
  private double targetAreaThreshold;
  private double maxTargetDistanceMeters;
  private double maxHeadingTagDistanceMeters;
  private double singleTagHeadingMaxDistanceMeters;
  private TagDistanceLimits tagDistanceLimits;
  private TagDistanceLimits enabledHeadingTagDistanceLimits;
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
    maxTargetDistanceMeters = config.maxTagDistanceMeters();
    targetAreaThreshold = config.targetAreaThreshold();
    maxHeadingTagDistanceMeters = headingConfig.maxTagDistanceMeters();
    singleTagHeadingMaxDistanceMeters = headingConfig.singleTagMaxDistanceMeters();
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
    // A zero area threshold preserves the existing position acceptance policy.
    PowerRobotContainer.setSubsystemVariableDefault("Vision", "Position/TargetAreaThreshold", targetAreaThreshold);
    PowerRobotContainer.setSubsystemVariableDefault("Vision", "Position/MaxTargetDistanceMeters", maxTargetDistanceMeters);
    PowerRobotContainer.setSubsystemVariableDefault("Vision", "Heading/MaxTagDistanceMeters", maxHeadingTagDistanceMeters);
    PowerRobotContainer.setSubsystemVariableDefault("Vision", "Heading/SingleTagMaxDistanceMeters", singleTagHeadingMaxDistanceMeters);
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
    return update(yawDegrees, pitchDegrees, rollDegrees, yawRateDegreesPerSecond, allowSingleTagHeading, true);
  }

  /** A trusted orientation requires an established field heading and healthy drivetrain feedback. */
  public Optional<Measurement> update(double yawDegrees, double pitchDegrees, double rollDegrees,
      double yawRateDegreesPerSecond, boolean allowSingleTagHeading, boolean trustedOrientation) {
    return update(yawDegrees, pitchDegrees, rollDegrees, yawRateDegreesPerSecond,
        allowSingleTagHeading, trustedOrientation, false);
  }

  /** Disabled heading uses the shared distance tiers and is exempt from the enabled yaw-rate limit. */
  public Optional<Measurement> update(double yawDegrees, double pitchDegrees, double rollDegrees,
      double yawRateDegreesPerSecond, boolean allowSingleTagHeading, boolean trustedOrientation, boolean disabled) {
    ensureOpen();
    headingMeasurements.clear();
    positionMeasurements.clear();
    boolean validOrientation = Double.isFinite(yawDegrees) && Double.isFinite(pitchDegrees)
        && Double.isFinite(rollDegrees);
    boolean canUseHeading = validOrientation && (disabled || (Double.isFinite(yawRateDegreesPerSecond)
        && Math.abs(yawRateDegreesPerSecond) <= headingConfig.maxYawRateDegreesPerSecond()));
    TagDistanceLimits headingLimits = disabled || enabledHeadingTagDistanceLimits == null
        ? tagDistanceLimits : enabledHeadingTagDistanceLimits;
    if (validOrientation) {
      orientation[0] = yawDegrees;
      orientation[1] = Double.isFinite(yawRateDegreesPerSecond) ? yawRateDegreesPerSecond : 0;
      orientation[2] = pitchDegrees;
      orientation[4] = rollDegrees;
      for (Camera camera : cameras) camera.orientation.set(orientation);
    }

    double now = clockSeconds.getAsDouble();
    syncTunableValues(now);
    boolean canSeedImu = trustedOrientation && validOrientation && Double.isFinite(yawRateDegreesPerSecond);
    for (Camera camera : cameras) {
      if (camera.imuSync != null) camera.imuSync.update(now, yawDegrees, yawRateDegreesPerSecond, canSeedImu);
    }
    // Send the whole group's orientation and mode updates before processing incoming poses.
    if (!cameras.isEmpty()) nt.flush();

    for (Camera camera : cameras) {
      TimestampedDoubleArray frame = camera.pose.getAtomic();
      TimestampedDoubleArray headingFrame = camera.headingPose.getAtomic();
      double frameReadTime = clockSeconds.getAsDouble();
      if (frame.timestamp > camera.lastSeenTimestamp) {
        // Consume skipped/rejected frames too; never replay them after enabling or slowing down.
        camera.lastSeenTimestamp = frame.timestamp;
        if (validOrientation) {
          var candidate = parseMeasurement(camera.name, frame, frameReadTime);
          if (candidate != null && (camera.imuSync == null
              || camera.imuSync.acceptsPosition(candidate.timestampSeconds()))) positionMeasurements.add(candidate);
        }
      }
      if (headingFrame.timestamp > camera.lastHeadingTimestamp) {
        camera.lastHeadingTimestamp = headingFrame.timestamp;
        if (canUseHeading) {
          var candidate = parseHeadingMeasurement(camera.name, headingFrame, frameReadTime, allowSingleTagHeading, headingLimits);
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
      double now, boolean allowSingleTagHeading, TagDistanceLimits limits) {
    Measurement measurement = parseMeasurement(name, frame, now, false, limits);
    if (measurement == null || (!allowSingleTagHeading && measurement.tagCount() < 2)
        || frame.value[8] < 0 || (measurement.tagCount() >= 2 && frame.value[8] == 0)
        || measurement.averageTagDistanceMeters() > maxHeadingTagDistanceMeters
        || now - measurement.timestampSeconds() > headingConfig.maxMeasurementAgeSeconds()) return null;
    double[] values = frame.value;
    double maxDistance = measurement.tagCount() == 1
        ? Math.min(maxHeadingTagDistanceMeters, singleTagHeadingMaxDistanceMeters)
        : maxHeadingTagDistanceMeters;
    if (measurement.tagCount() == 1 && limits != null) maxDistance = Math.min(maxDistance, limits.oneTagMeters());
    double maxAmbiguity = 0;
    for (int i = 11; i < values.length; i += 7) {
      double id = values[i], ambiguity = values[i + 6];
      if (id <= 0 || id != Math.rint(id) || values[i + 4] < 0
          || (limits == null && values[i + 4] > maxDistance)
          || ambiguity < 0 || ambiguity > headingConfig.maxTagAmbiguity()) return null;
      maxAmbiguity = Math.max(maxAmbiguity, ambiguity);
      for (int previous = 11; previous < i; previous += 7) if (values[previous] == id) return null;
    }
    var heading = new HeadingMeasurement(name, measurement.pose(), measurement.timestampSeconds(),
        headingConfig.headingStdDevRadians(), measurement.tagCount(), measurement.averageTagDistanceMeters(),
        maxAmbiguity, values[8], maxDistance);
    return measurement.tagCount() > 1 || heading.reliableSingleTag(now) ? heading : null;
  }

  private Measurement parseMeasurement(String name, TimestampedDoubleArray frame, double now) {
    return parseMeasurement(name, frame, now, true, tagDistanceLimits);
  }

  private Measurement parseMeasurement(String name, TimestampedDoubleArray frame, double now, boolean position,
      TagDistanceLimits limits) {
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
    // Header[10] is average tag area as a percentage of the image.
    int count = (values.length - 11) / 7;
    if (count == 0 || values[7] != count || values[6] < 0.0
        || values[9] < 0.0 || (position && values[10] < targetAreaThreshold)) {
      return null;
    }
    double timestamp = frame.timestamp / 1000000.0 - values[6] / 1000.0;
    double age = now - timestamp;
    if (!Double.isFinite(age) || age < 0.0 || age > config.maxMeasurementAgeSeconds()) {
      return null;
    }
    double averageDistance = values[9];
    if (limits != null) {
      TagGroup group = qualifyingTags(values, position, limits);
      if (group == null) return null;
      count = group.count();
      averageDistance = group.averageDistanceMeters();
    } else if (position && averageDistance >= maxTargetDistanceMeters) {
      return null;
    }
    double stdDev = Math.max(MIN_POSITION_STD_DEV,
        config.basePositionStdDev() * averageDistance * averageDistance / count * measurementStdDevScale);
    if (!Double.isFinite(stdDev)) {
      return null;
    }
    return new Measurement(name,
        new Pose2d(values[0], values[1], Rotation2d.fromDegrees(values[5])),
        timestamp, count, averageDistance, stdDev, values[2]);
  }

  private TagGroup qualifyingTags(double[] values, boolean position, TagDistanceLimits limits) {
    double maxDistance = position ? maxTargetDistanceMeters : maxHeadingTagDistanceMeters;
    double threeLimit = Math.min(limits.threeTagMeters(), maxDistance);
    double twoLimit = Math.min(limits.twoTagMeters(), maxDistance);
    double oneLimit = Math.min(limits.oneTagMeters(), maxDistance);
    if (!position) oneLimit = Math.min(oneLimit, singleTagHeadingMaxDistanceMeters);
    int threeCount = 0, twoCount = 0, oneCount = 0;
    double threeDistance = 0, twoDistance = 0, oneDistance = 0;
    var seenIds = new HashSet<Double>();
    for (int i = 11; i < values.length; i += 7) {
      double id = values[i], distance = values[i + 4];
      if (id <= 0 || id != Math.rint(id) || distance < 0 || !seenIds.add(id)) return null;
      if (distance <= threeLimit) { threeCount++; threeDistance += distance; }
      if (distance <= twoLimit) { twoCount++; twoDistance += distance; }
      if (distance <= oneLimit) { oneCount++; oneDistance += distance; }
    }
    // The Limelight pose remains the original solve. Only qualification and weighting use this group.
    if (threeCount >= 3) return new TagGroup(threeCount, threeDistance / threeCount);
    if (twoCount >= 2) return new TagGroup(twoCount, twoDistance / twoCount);
    return oneCount == 1 ? new TagGroup(1, oneDistance) : null;
  }

  /** Qualify the reported pose by the largest group of tags within the configured distances. */
  public void setTagDistanceLimits(TagDistanceLimits limits) {
    ensureOpen();
    tagDistanceLimits = Objects.requireNonNull(limits);
  }

  /** Override only the MegaTag1 heading tiers while enabled. */
  public void setEnabledHeadingTagDistanceLimits(TagDistanceLimits limits) {
    ensureOpen();
    enabledHeadingTagDistanceLimits = Objects.requireNonNull(limits);
  }

  private void syncTunableValues(double now) {
    if (!PowerRobotContainer.isTuningEnabled() || !tuningCadence.isDue(now)) return;
    double area = PowerRobotContainer.getSubsystemVariable("Vision", "Position/TargetAreaThreshold", targetAreaThreshold);
    double distance = PowerRobotContainer.getSubsystemVariable("Vision", "Position/MaxTargetDistanceMeters", maxTargetDistanceMeters);
    double headingDistance = PowerRobotContainer.getSubsystemVariable("Vision", "Heading/MaxTagDistanceMeters", maxHeadingTagDistanceMeters);
    double singleTagDistance = PowerRobotContainer.getSubsystemVariable("Vision", "Heading/SingleTagMaxDistanceMeters", singleTagHeadingMaxDistanceMeters);
    if (Double.isFinite(area) && area >= 0 && area <= 100) targetAreaThreshold = area;
    if (Double.isFinite(distance) && distance > 0) maxTargetDistanceMeters = distance;
    if (Double.isFinite(headingDistance) && headingDistance > 0) maxHeadingTagDistanceMeters = headingDistance;
    if (Double.isFinite(singleTagDistance) && singleTagDistance > 0) singleTagHeadingMaxDistanceMeters = singleTagDistance;
  }

  /** Optional robot-specific adjustment, e.g. a value below one to trust vision more during slip. */
  public void setMeasurementStdDevScale(double scale) {
    ensureOpen();
    if (!Double.isFinite(scale) || scale <= 0.0) {
      throw new IllegalArgumentException("Measurement standard deviation scale must be finite and positive");
    }
    measurementStdDevScale = scale;
  }

  /** Automatically seed and verify cameras that report supported internal IMU telemetry. */
  public void enableIMUAssist() {
    ensureOpen();
    for (Camera camera : cameras) {
      if (camera.imuSync == null) {
        camera.imuMode.set(0);
        camera.imuAssist.set(0.001);
        camera.imuSync = new LimelightImuSync(nt.getTable(camera.name), camera.imuMode);
      }
    }
  }

  /** IMU diagnostics for cameras managed by automatic sync. */
  public List<ImuStatus> getImuStatuses() {
    ensureOpen();
    return cameras.stream().filter(camera -> camera.imuSync != null)
        .map(camera -> camera.imuSync.status(camera.name)).toList();
  }

  /** Reseed managed cameras with the new field heading on the next update. */
  public void reseedIMUs() {
    ensureOpen();
    for (Camera camera : cameras) {
      if (camera.imuSync != null) camera.imuSync.requestReseed();
    }
  }

  /** Set a fixed mode on all cameras and relinquish automatic IMU sync. */
  public void setIMUMode(int mode) {
    ensureOpen();
    if (mode < 0 || mode > 4) {
      throw new IllegalArgumentException("IMU mode must be between 0 and 4");
    }
    for (Camera camera : cameras) {
      if (camera.imuSync != null) {
        camera.imuSync.close();
        camera.imuSync = null;
      }
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
