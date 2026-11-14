package frc.powerlib.vision;

import static org.junit.Assert.*;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.math.VecBuilder;
import edu.wpi.first.math.estimator.SwerveDrivePoseEstimator;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.SwerveDriveKinematics;
import edu.wpi.first.math.kinematics.SwerveModulePosition;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.PubSubOption;
import frc.powerlib.configs.LimelightHeadingConfig;
import frc.powerlib.configs.LimelightVisionConfig;
import frc.powerlib.configs.VisionHeadingInitializationConfig;
import frc.powerlib.PowerRobotContainer;
import java.util.Arrays;
import org.junit.BeforeClass;
import org.junit.Test;

public class LimelightVisionTest {
  @BeforeClass public static void initialize() { assertTrue(HAL.initialize(500, 0)); }

  private static final class Fixture implements AutoCloseable {
    final NetworkTableInstance nt = NetworkTableInstance.create();
    double now = 10;
    final LimelightVision reader = new LimelightVision(nt, LimelightVisionConfig.DEFAULT,
        LimelightHeadingConfig.DEFAULT, () -> now, "first", "second");

    void publish(String camera, String topic, double[] values, double receiveTime) {
      nt.getTable(camera).getDoubleArrayTopic(topic).getEntry(new double[0], PubSubOption.keepDuplicates(true))
          .set(values, (long) (receiveTime * 1e6));
    }

    void heading(double[] values) { publish("first", "botpose_wpiblue", values, now); }
    void update(double rate) { reader.update(0, 0, 0, rate); }
    void publishImu(String camera, double yaw, double heartbeat) {
      publish(camera, "imu", new double[] {yaw, 0, 0, 0, 0, 0, 0, 0, 0, 1}, now);
      nt.getTable(camera).getDoubleTopic("hb").getEntry(Double.NaN).set(heartbeat, (long) (now * 1e6));
    }
    double number(String camera, String topic) {
      return nt.getTable(camera).getEntry(topic).getDouble(Double.NaN);
    }
    @Override public void close() { reader.close(); nt.close(); }
  }

  private static double[] frame(int tags, double yaw) {
    double[] values = new double[11 + 7 * tags];
    values[0] = 2; values[1] = 3; values[5] = yaw;
    values[6] = 50; values[7] = tags; values[8] = 1; values[9] = 2;
    for (int tag = 0; tag < tags; tag++) {
      int start = 11 + tag * 7;
      values[start] = tag + 1;
      values[start + 4] = 2; values[start + 5] = 2; values[start + 6] = 0.05;
    }
    return values;
  }

  @Test public void imuAssistWaitsForTrustedHeadingAndFreshAlignedPositionPerCamera() {
    try (var fixture = new Fixture()) {
      fixture.reader.enableIMUAssist();
      fixture.nt.getTable("first").getEntry("imu_yaw_offset").setDouble(0);
      fixture.publishImu("first", 179, 10);
      fixture.publishImu("second", 179, 10); // Older firmware can publish IMU data without the new diagnostic.
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, 179), fixture.now);
      fixture.reader.update(179, 0, 0, 0, true, false);
      assertEquals(0, fixture.number("first", "imumode_set"), 0);
      assertEquals("first", fixture.reader.getPositionMeasurements().get(0).cameraName());

      fixture.now = 10.10;
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, 179), fixture.now);
      fixture.publish("second", "botpose_orb_wpiblue", frame(2, 179), fixture.now);
      fixture.heading(frame(2, 179));
      fixture.reader.update(179, 0, 0, 0, true, true);
      assertEquals(1, fixture.number("first", "imumode_set"), 0);
      assertEquals(0.001, fixture.number("first", "imuassistalpha_set"), 0);
      assertEquals(0, fixture.number("second", "imumode_set"), 0);
      assertEquals(java.util.List.of("second"), fixture.reader.getPositionMeasurements().stream()
          .map(LimelightVision.Measurement::cameraName).toList());
      assertEquals("first", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());

      fixture.now = 10.35;
      fixture.publishImu("first", 179, 20);
      fixture.reader.update(179, 0, 0, 0);
      assertEquals(4, fixture.number("first", "imumode_set"), 0);

      fixture.now = 10.50;
      fixture.publishImu("first", -150, 25);
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, -150), fixture.now);
      assertTrue(fixture.reader.update(179, 0, 0, 0).isEmpty());

      fixture.now = 10.55;
      fixture.publishImu("first", -179, 27);
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, -179), fixture.now);
      assertTrue("A pre-confirmation capture is dropped", fixture.reader.update(179, 0, 0, 0).isEmpty());

      fixture.now = 10.65;
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, -179), fixture.now);
      assertEquals("first", fixture.reader.update(179, 0, 0, 0).orElseThrow().cameraName());

      fixture.reader.reseedIMUs();
      fixture.now = 10.70;
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, -179), fixture.now);
      assertTrue(fixture.reader.update(45, 0, 0, 0).isEmpty());
      assertEquals(1, fixture.number("first", "imumode_set"), 0);
      assertEquals(45, fixture.nt.getTable("first").getEntry("robot_orientation_set").getDoubleArray(new double[0])[0], 0);
    }
  }

  @Test public void imuAssistReseedsOnlyTheCameraThatRebootsOrLosesTelemetry() {
    try (var fixture = new Fixture()) {
      fixture.reader.enableIMUAssist();
      for (String camera : new String[] {"first", "second"}) {
        fixture.nt.getTable(camera).getEntry("imu_yaw_offset").setDouble(0);
        fixture.publishImu(camera, 0, 100);
      }
      fixture.update(0);
      fixture.now = 10.25;
      fixture.publishImu("first", 0, 110);
      fixture.publishImu("second", 0, 110);
      fixture.update(0);
      fixture.now = 10.40;
      fixture.publishImu("first", 0, 115);
      fixture.publishImu("second", 0, 115);
      fixture.update(0);

      fixture.now = 10.50;
      fixture.publishImu("first", 0, 1);
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, 0), fixture.now);
      fixture.publish("second", "botpose_orb_wpiblue", frame(2, 0), fixture.now);
      fixture.update(0);
      assertEquals(1, fixture.number("first", "imumode_set"), 0);
      assertEquals(4, fixture.number("second", "imumode_set"), 0);
      assertEquals(java.util.List.of("second"), fixture.reader.getPositionMeasurements().stream()
          .map(LimelightVision.Measurement::cameraName).toList());

      fixture.now = 10.75;
      fixture.publishImu("first", 0, 10);
      fixture.publish("second", "botpose_orb_wpiblue", frame(2, 0), fixture.now);
      fixture.update(0);
      assertEquals(4, fixture.number("first", "imumode_set"), 0);
      assertEquals(1, fixture.number("second", "imumode_set"), 0);
      assertTrue(fixture.reader.getPositionMeasurements().isEmpty());

      fixture.now = 10.90;
      fixture.publishImu("first", 0, 15);
      fixture.update(0);
      fixture.now = 11.00;
      fixture.publishImu("first", 20, 20);
      fixture.publish("first", "botpose_orb_wpiblue", frame(2, 20), fixture.now);
      fixture.update(0);
      assertEquals("A large running yaw error requests a reseed", 1, fixture.number("first", "imumode_set"), 0);
      assertTrue(fixture.reader.getPositionMeasurements().isEmpty());
    }
  }

  @Test public void headingDistanceTunablesApplyToBothRecoveryPoliciesAndRetainValidLimits() {
    try (var fixture = new Fixture()) {
      var single = frame(1, 0);
      single[8] = 0; single[9] = 2.5; single[15] = 2.5; single[16] = 2.5;
      fixture.heading(single);
      fixture.reader.update(0, 0, 0, 0, true);
      assertTrue("Default single-tag limit is two meters", fixture.reader.getHeadingMeasurement().isEmpty());
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/SingleTagMaxDistanceMeters", 3.0);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/MaxTagDistanceMeters", 7.0);
      PowerRobotContainer.setTuningEnabled(true);
      fixture.now += .25; fixture.heading(single);
      fixture.reader.update(0, 0, 0, 0, true);
      var accepted = fixture.reader.getHeadingMeasurement().orElseThrow();
      assertTrue("Downstream single-tag checks honor the tuned limit", accepted.reliableSingleTag(fixture.now));
      var collector = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, .2);
      java.util.Optional<Rotation2d> rotation = java.util.Optional.empty();
      for (int index = 0; index < 13 && rotation.isEmpty(); index++) {
        fixture.now += .05; fixture.heading(single);
        fixture.reader.update(0, 0, 0, 0, true);
        rotation = collector.observe(fixture.reader.getHeadingMeasurement().orElseThrow(), fixture.now, 0, 0);
      }
      assertTrue("Configured single-tag distance can complete stable heading recovery", rotation.isPresent());
      var multi = frame(2, 0); multi[9] = 6.5;
      for (int start = 11; start < multi.length; start += 7) { multi[start + 4] = 6.5; multi[start + 5] = 6.5; }
      fixture.now += .25; fixture.heading(multi); fixture.update(0);
      assertTrue("Heading distance is independent of the position distance limit", fixture.reader.getHeadingMeasurement().isPresent());
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/MaxTagDistanceMeters", 2.0);
      fixture.now += .25; fixture.heading(single); fixture.reader.update(0, 0, 0, 0, true);
      assertTrue("The overall heading limit also constrains single tags", fixture.reader.getHeadingMeasurement().isEmpty());
      PowerRobotContainer.setTuningEnabled(false);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/MaxTagDistanceMeters", 7.0);
      fixture.now += .25; fixture.heading(multi); fixture.update(0);
      assertTrue("Disabled tuning keeps the last applied heading limit", fixture.reader.getHeadingMeasurement().isEmpty());
      PowerRobotContainer.setTuningEnabled(true);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/MaxTagDistanceMeters", -1.0);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/SingleTagMaxDistanceMeters", Double.NaN);
      fixture.now += .25; fixture.heading(single); fixture.reader.update(0, 0, 0, 0, true);
      assertTrue("Invalid edits keep the previous heading limits", fixture.reader.getHeadingMeasurement().isEmpty());
    } finally {
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/MaxTagDistanceMeters", 4.0);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Heading/SingleTagMaxDistanceMeters", 2.0);
      PowerRobotContainer.setTuningEnabled(false);
    }
  }

  @Test public void localizationStartupConfigsPreserveCompatibilityAndRejectInvalidDistances() {
    var heading = LimelightHeadingConfig.DEFAULT.withDistanceLimits(5.0, 3.0);
    assertEquals(5.0, heading.maxTagDistanceMeters(), 0);
    assertEquals(3.0, heading.singleTagMaxDistanceMeters(), 0);
    assertEquals(LimelightHeadingConfig.DEFAULT.headingStdDevRadians(), heading.headingStdDevRadians(), 0);
    var position = LimelightVisionConfig.DEFAULT.withPositionLimits(5.5, 1.0);
    assertEquals(1.0, position.targetAreaThreshold(), 0);
    assertEquals(5.5, position.maxTagDistanceMeters(), 0);
    assertEquals(LimelightVisionConfig.DEFAULT.basePositionStdDev(), position.basePositionStdDev(), 0);
    for (double invalid : new double[] { 0, -1, Double.NaN, Double.POSITIVE_INFINITY }) {
      assertThrows(IllegalArgumentException.class, () -> LimelightHeadingConfig.DEFAULT.withDistanceLimits(invalid, 2));
      assertThrows(IllegalArgumentException.class, () -> LimelightHeadingConfig.DEFAULT.withDistanceLimits(4, invalid));
    }
    assertThrows(IllegalArgumentException.class, () -> LimelightVisionConfig.DEFAULT.withPositionLimits(5, 101));
  }

  @Test public void locationTunablesFilterPositionAndRetainLastValidValuesWithoutChangingHeading() {
    try (var fixture = new Fixture()) {
      var values = frame(2, 0);
      values[10] = 0.5;
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/TargetAreaThreshold", 1.0);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/MaxTargetDistanceMeters", 5.0);
      // Disabled tuning does not apply pending edits.
      PowerRobotContainer.setTuningEnabled(false);
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      assertTrue(fixture.reader.update(0, 0, 0, 0).isPresent());
      PowerRobotContainer.setTuningEnabled(true);
      fixture.now += .25;
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      assertTrue(fixture.reader.update(0, 0, 0, 0).isEmpty());
      values[10] = 2;
      fixture.now += .25;
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      assertTrue(fixture.reader.update(0, 0, 0, 0).isPresent());
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/MaxTargetDistanceMeters", 1.0);
      fixture.now += .25;
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      fixture.heading(values);
      assertTrue(fixture.reader.update(0, 0, 0, 0).isEmpty());
      assertTrue("Heading retains its own filters", fixture.reader.getHeadingMeasurement().isPresent());
      PowerRobotContainer.setTuningEnabled(false);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/MaxTargetDistanceMeters", 5.0);
      fixture.now += .25;
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      assertTrue("Disabling tuning retains the last applied limits", fixture.reader.update(0, 0, 0, 0).isEmpty());
      PowerRobotContainer.setTuningEnabled(true);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/MaxTargetDistanceMeters", -1.0);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/TargetAreaThreshold", Double.NaN);
      fixture.now += .25;
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      assertTrue("Invalid edits retain valid limits", fixture.reader.update(0, 0, 0, 0).isEmpty());
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/MaxTargetDistanceMeters", 6.25);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/TargetAreaThreshold", 0.0);
      fixture.now += .25;
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      assertTrue(fixture.reader.update(0, 0, 0, 0).isPresent());
    } finally {
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/MaxTargetDistanceMeters", 6.25);
      PowerRobotContainer.updateSubsystemVariable("Vision", "Position/TargetAreaThreshold", 0.0);
      PowerRobotContainer.setTuningEnabled(false);
    }
  }

  @Test public void selectsIndependentHeadingWithoutChangingMegaTag2Weights() {
    try (var fixture = new Fixture()) {
      fixture.publish("first", "botpose_orb_wpiblue", frame(1, 40), fixture.now);
      fixture.heading(frame(2, 5));
      var position = fixture.reader.update(40, 0, 0, 10).orElseThrow();
      var heading = fixture.reader.getHeadingMeasurement().orElseThrow();
      assertEquals(40, position.pose().getRotation().getDegrees(), 1e-9);
      assertEquals(5, heading.pose().getRotation().getDegrees(), 1e-9);
      assertEquals(9.95, heading.timestampSeconds(), 1e-9);
      assertEquals(0.28, position.standardDeviations().get(0, 0), 1e-9);
      assertTrue(position.standardDeviations().get(2, 0) > 1e7);
      assertTrue(heading.standardDeviations().get(0, 0) > 1e7);
      assertEquals(Math.toRadians(20), heading.standardDeviations().get(2, 0), 1e-9);
      double[] orientation = fixture.nt.getTable("first").getEntry("robot_orientation_set").getDoubleArray(new double[0]);
      assertEquals(40, orientation[0], 0);
      assertEquals(10, orientation[1], 0);
    }
  }

  @Test public void preservesHeightForPositionPlausibilityChecksAndKeepsPlanarCompatibility() {
    try (var fixture = new Fixture()) {
      var values = frame(1, 0);
      values[2] = 1.5;
      fixture.publish("first", "botpose_orb_wpiblue", values, fixture.now);
      var measurement = fixture.reader.update(0, 0, 0, 0).orElseThrow();
      assertEquals(1.5, measurement.heightMeters(), 0);
      assertEquals(0, new LimelightVision.Measurement("test", new Pose2d(), 10, 1, 2, .28).heightMeters(), 0);
    }
  }

  @Test public void headingNeedsMultipleDistinctReliableTags() {
    double[][] invalid = { frame(0, 5), frame(1, 5), frame(2, 5), frame(2, 5), frame(2, 5), frame(2, 5), frame(2, 5), frame(2, 5) };
    invalid[2][24] = 0.3; // Second tag ambiguity, not just the first tag's quality.
    invalid[3][18] = 1; // Same ID as the first tag.
    invalid[4][11] = 1.5;
    invalid[5][17] = -0.1;
    invalid[6][8] = 0;
    invalid[7][22] = 5; // A far individual tag cannot be hidden by a low average distance.
    for (double[] values : invalid) {
      try (var fixture = new Fixture()) {
        fixture.heading(values); fixture.update(0);
        assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
      }
    }
  }

  @Test public void disabledSingleTagFallbackStillRequiresReliableFramesAndCannotReplayWhenEnabled() {
    try (var fixture = new Fixture()) {
      var single = frame(1, 90);
      single[8] = 0; // A single tag has no multi-tag span.
      fixture.heading(single);
      fixture.reader.update(0, 0, 0, 0, true);
      assertEquals(90, fixture.reader.getHeadingMeasurement().orElseThrow().pose().getRotation().getDegrees(), 1e-9);
      fixture.update(0);
      assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
      fixture.now += 0.02;
      fixture.heading(single);
      fixture.update(0);
      assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
      fixture.now += 0.02;
      single[17] = 0.3;
      fixture.heading(single);
      fixture.reader.update(0, 0, 0, 0, true);
      assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
    }
  }

  @Test public void disabledHeadingPrefersMultipleTagsAcrossCamerasAndFallsBackAfterRejection() {
    try (var fixture = new Fixture()) {
      fixture.heading(frame(1, 80));
      fixture.publish("second", "botpose_wpiblue", frame(2, 90), fixture.now);
      fixture.reader.update(0, 0, 0, 0, true);
      assertEquals("second", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());
      fixture.now += 0.02;
      fixture.heading(frame(1, 80));
      var unreliable = frame(2, 90);
      unreliable[24] = 0.3;
      fixture.publish("second", "botpose_wpiblue", unreliable, fixture.now);
      fixture.reader.update(0, 0, 0, 0, true);
      assertEquals("first", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());
    }
  }

  @Test public void stableSingleTagFramesCanInitializeDisabledHeading() {
    try (var fixture = new Fixture()) {
      var initializer = new VisionHeadingInitializer(VisionHeadingInitializationConfig.DEFAULT, 0.2);
      var single = frame(1, 90);
      single[8] = 0;
      java.util.Optional<Rotation2d> result = java.util.Optional.empty();
      for (int i = 0; i < 27 && result.isEmpty(); i++) {
        fixture.now = 10 + i * 0.02;
        fixture.heading(single);
        fixture.reader.update(0, 0, 0, 0, true);
        result = initializer.update(fixture.reader.getHeadingMeasurement().orElseThrow(), fixture.now, 0, 0);
      }
      assertEquals(90, result.orElseThrow().getDegrees(), 1e-9);
    }
  }

  @Test public void singleTagFallbackRejectsWeakGeometryAmbiguityAndAge() {
    for (int fault = 0; fault < 4; fault++) {
      try (var fixture = new Fixture()) {
        var single = frame(1, 90);
        single[8] = 0;
        switch (fault) {
          case 0 -> single[9] = 2.01;
          case 1 -> single[17] = .051;
          case 2 -> single[6] = 101;
          case 3 -> single[15] = 2.01;
        }
        fixture.heading(single);
        fixture.reader.update(0, 0, 0, 0, true);
        assertTrue("Weak single-tag heading must be rejected: " + fault,
            fixture.reader.getHeadingMeasurements().isEmpty());
      }
    }
  }

  @Test public void rejectsFarStaleFutureNonfiniteAndMalformedHeadingFrames() {
    double[][] invalid = { frame(2, 5), frame(2, 5), frame(2, 5), frame(2, 5), frame(2, 5), new double[10] };
    invalid[0][9] = 4.1;
    invalid[1][6] = 201;
    invalid[2][5] = Double.NaN;
    invalid[3][7] = 3;
    invalid[4][6] = -1;
    for (double[] values : invalid) {
      try (var fixture = new Fixture()) {
        fixture.heading(values); fixture.update(0);
        assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
      }
    }
    try (var fixture = new Fixture()) {
      fixture.publish("first", "botpose_wpiblue", frame(2, 5), fixture.now + 1);
      fixture.update(0);
      assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
    }
  }

  @Test public void rejectedFastTurnAndRepeatedFramesCannotBeReplayed() {
    for (double rate : new double[] {46, -46, Double.NaN, Double.POSITIVE_INFINITY}) {
      try (var fixture = new Fixture()) {
        fixture.heading(frame(2, 5)); fixture.update(rate);
        assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
        fixture.update(0);
        assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
        fixture.now += 0.02; fixture.heading(frame(2, 5)); fixture.update(0);
        assertTrue(fixture.reader.getHeadingMeasurement().isPresent());
        fixture.update(0);
        assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
      }
    }
  }

  @Test public void consumesBothCamerasAndFallsBackOnlyToAFreshGoodFrame() {
    try (var fixture = new Fixture()) {
      fixture.heading(frame(2, 5));
      fixture.publish("second", "botpose_wpiblue", frame(2, 6), fixture.now);
      fixture.update(0);
      assertEquals("first", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());
      fixture.update(0);
      assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
      fixture.now += 0.02;
      fixture.heading(frame(1, 5));
      fixture.publish("second", "botpose_wpiblue", frame(2, 6), fixture.now);
      fixture.update(0);
      assertEquals("second", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());
    }
  }

  @Test public void positionOnlyAndInvalidOrientationUpdatesConsumeUnusedHeadingFrames() {
    try (var fixture = new Fixture()) {
      fixture.heading(frame(2, 5));
      fixture.publish("first", "botpose_orb_wpiblue", frame(1, 0), fixture.now);
      assertTrue(fixture.reader.update(0, 0, 0).isPresent());
      fixture.update(0);
      assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
      fixture.now += 0.02; fixture.heading(frame(2, 5));
      fixture.reader.update(Double.NaN, 0, 0, 0);
      fixture.update(0);
      assertTrue(fixture.reader.getHeadingMeasurement().isEmpty());
    }
  }

  @Test public void correctionUsesHistoricalTranslationWrapsAnglesAndRejectsLargeJumps() {
    var measurement = new LimelightVision.HeadingMeasurement("camera",
        new Pose2d(20, 30, Rotation2d.fromDegrees(-179)), 1, Math.toRadians(20));
    var historical = new Pose2d(2, 3, Rotation2d.fromDegrees(179));
    var corrected = measurement.correctionPose(historical, 15).orElseThrow();
    assertEquals(historical.getTranslation(), corrected.getTranslation());
    assertEquals(-179, corrected.getRotation().getDegrees(), 1e-9);
    assertTrue(measurement.correctionPose(new Pose2d(), 15).isEmpty());
    assertTrue(measurement.correctionPose(null, 15).isEmpty());
    assertTrue(measurement.correctionPose(historical, Double.NaN).isEmpty());
    // Comparing with a later rotated pose would wrongly reject this valid capture-time heading.
    assertTrue(measurement.correctionPose(new Pose2d(2, 3, Rotation2d.fromDegrees(120)), 15).isEmpty());
  }

  @Test public void estimatorGraduallyCorrectsDriftWithoutChangingMeasuredGyroOrTranslation() {
    var kinematics = new SwerveDriveKinematics(new Translation2d(0.3, 0.3), new Translation2d(0.3, -0.3),
        new Translation2d(-0.3, 0.3), new Translation2d(-0.3, -0.3));
    var modules = new SwerveModulePosition[4];
    Arrays.setAll(modules, i -> new SwerveModulePosition());
    var gyro = Rotation2d.fromDegrees(20);
    var estimator = new SwerveDrivePoseEstimator(kinematics, gyro, modules, new Pose2d(2, 3, gyro),
        VecBuilder.fill(0.1, 0.1, 0.1), VecBuilder.fill(1, 1, 1));
    double previous = 20;
    for (int i = 0; i < 5; i++) {
      double timestamp = 1 + i * 0.02;
      estimator.updateWithTime(timestamp, gyro, modules);
      var measurement = new LimelightVision.HeadingMeasurement("camera",
          new Pose2d(20, 30, Rotation2d.fromDegrees(15)), timestamp, Math.toRadians(20));
      var historical = estimator.sampleAt(timestamp).orElseThrow();
      estimator.addVisionMeasurement(measurement.correctionPose(historical, 15).orElseThrow(),
          timestamp, measurement.standardDeviations());
      double corrected = estimator.getEstimatedPosition().getRotation().getDegrees();
      assertTrue(corrected < previous && corrected > 15);
      assertEquals(2, estimator.getEstimatedPosition().getX(), 1e-9);
      assertEquals(3, estimator.getEstimatedPosition().getY(), 1e-9);
      // A subsequent MT2 position update from the same frame must not restore the drifted yaw.
      estimator.addVisionMeasurement(new Pose2d(2, 3, gyro), timestamp, VecBuilder.fill(0.7, 0.7, 99999999));
      assertEquals(corrected, estimator.getEstimatedPosition().getRotation().getDegrees(), 1e-7);
      previous = corrected;
    }
    assertEquals(20, gyro.getDegrees(), 1e-9);
  }

  @Test public void delayedHeadingPreservesNewerPositionAndInterveningRotation() {
    var capture = new Pose2d(2, 3, Rotation2d.fromDegrees(179));
    var newer = new Pose2d(4, 5, Rotation2d.fromDegrees(-160));
    var heading = new LimelightVision.HeadingMeasurement("camera",
        new Pose2d(20, 30, Rotation2d.fromDegrees(-179)), 1, Math.toRadians(20));
    var corrected = heading.correctionPose(capture, newer, 15).orElseThrow();
    assertEquals(newer.getTranslation(), corrected.getTranslation());
    assertEquals(-158, corrected.getRotation().getDegrees(), 1e-9);
    assertTrue(heading.correctionPose(new Pose2d(), newer, 15).isEmpty());
    assertTrue(heading.correctionPose(capture, null, 15).isEmpty());
  }

  @Test public void headingConfigurationRejectsInvalidLimits() {
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0, 4, 0.2, 45, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, Double.NaN, 0.2, 45, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, -0.2, 45, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, 0.2, 0, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, 0.2, 45, 181, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, 0.2, 45, 15, 1.1));
  }

  @Test public void exposesFreshPositionCandidatesForDownstreamFallbackAndClearsThemNextLoop() {
    try (var fixture = new Fixture()) {
      var outside = frame(2, 0);
      outside[0] = 30;
      fixture.publish("first", "botpose_orb_wpiblue", outside, fixture.now);
      fixture.publish("second", "botpose_orb_wpiblue", frame(2, 0), fixture.now);
      assertEquals("first", fixture.reader.update(0, 0, 0, 0).orElseThrow().cameraName());
      var candidates = fixture.reader.getPositionMeasurements();
      assertEquals(2, candidates.size());
      assertEquals("second", candidates.get(1).cameraName());
      assertThrows(UnsupportedOperationException.class, () -> candidates.clear());
      fixture.update(0);
      assertTrue(fixture.reader.getPositionMeasurements().isEmpty());
    }
  }

  @Test public void exposesAllHeadingsWithMultiTagPreferenceAndConsumesThemOnce() {
    try (var fixture = new Fixture()) {
      fixture.heading(frame(1, 80));
      fixture.publish("second", "botpose_wpiblue", frame(2, 5), fixture.now);
      fixture.reader.update(0, 0, 0, 0, true);
      var candidates = fixture.reader.getHeadingMeasurements();
      assertEquals(2, candidates.size());
      assertEquals("second", candidates.get(0).cameraName());
      assertEquals(2, candidates.get(0).tagCount());
      assertEquals("first", candidates.get(1).cameraName());
      assertEquals(1, candidates.get(1).tagCount());
      assertThrows(UnsupportedOperationException.class, candidates::clear);
      fixture.update(0);
      assertTrue(candidates.isEmpty());
    }
  }

  @Test public void laterHeadingRemainsAvailableAfterTiltCaptureRejection() {
    try (var fixture = new Fixture()) {
      var old = frame(2, 90);
      old[6] = 150;
      old[9] = 1; // Better geometric quality, but capture-time filtering must still reject it.
      var recent = frame(2, 5);
      recent[6] = 20;
      fixture.heading(old);
      fixture.publish("second", "botpose_wpiblue", recent, fixture.now);
      fixture.update(0);
      var filter = new VisionPoseFilter(
          frc.powerlib.configs.VisionPoseFilterConfig.forField(0, 17.548, 0, 8.052), .5);
      for (int i = 0; i <= 25; i++) filter.observe(9.75 + i * .01, 0, 0, true);
      var candidates = fixture.reader.getHeadingMeasurements();
      assertEquals(2, candidates.size());
      assertFalse(filter.captureAllowed(candidates.get(0).timestampSeconds(), fixture.now));
      assertTrue(filter.captureAllowed(candidates.get(1).timestampSeconds(), fixture.now));
    }
  }

  @Test public void laterHeadingCanFuseAfterPrimaryFailsErrorOrHistoryChecks() {
    for (boolean missingHistory : new boolean[] {false, true}) {
      try (var fixture = new Fixture()) {
        var primary = frame(2, 90);
        primary[6] = 150;
        primary[9] = 1;
        fixture.heading(primary);
        fixture.publish("second", "botpose_wpiblue", frame(2, 5), fixture.now);
        fixture.update(0);
        var applied = new java.util.ArrayList<Pose2d>();
        var fusion = new VisionMeasurementFusion(.5,
            timestamp -> missingHistory && timestamp < 9.9
                ? java.util.Optional.empty() : java.util.Optional.of(new Pose2d()),
            (pose, timestamp, deviations) -> applied.add(pose));
        var candidates = fixture.reader.getHeadingMeasurements();
        assertFalse(fusion.addHeading(candidates.get(0), fixture.now, 45));
        assertTrue(fusion.addHeading(candidates.get(1), fixture.now, 45));
        assertEquals(1, applied.size());
        assertEquals(5, applied.get(0).getRotation().getDegrees(), 1e-9);
      }
    }
  }

  @Test public void selectsLowestUncertaintyPositionAndBestGeometricHeading() {
    try (var fixture = new Fixture()) {
      var poor = frame(2, 30);
      poor[9] = 3.5;
      var good = frame(3, 0);
      good[9] = 1.5;
      for (String topic : new String[] {"botpose_wpiblue", "botpose_orb_wpiblue"}) {
        fixture.publish("first", topic, poor, fixture.now);
        fixture.publish("second", topic, good, fixture.now);
      }
      assertEquals("second", fixture.reader.update(0, 0, 0, 0).orElseThrow().cameraName());
      var heading = fixture.reader.getHeadingMeasurement().orElseThrow();
      assertEquals("second", heading.cameraName());
      assertEquals(3, heading.tagCount());
      assertEquals(1.5, heading.averageTagDistanceMeters(), 0);
      assertEquals(.05, heading.maxTagAmbiguity(), 0);
    }
  }

  @Test public void headingQualityUsesAmbiguitySpanAndFreshnessBeforeConfiguredOrder() {
    try (var fixture = new Fixture()) {
      var poor = frame(2, 30);
      var good = frame(2, 0);
      poor[17] = .15;
      fixture.heading(poor);
      fixture.publish("second", "botpose_wpiblue", good, fixture.now);
      fixture.update(0);
      assertEquals("second", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());
      fixture.now += .02;
      poor[17] = .05;
      good[8] = 2;
      fixture.heading(poor);
      fixture.publish("second", "botpose_wpiblue", good, fixture.now);
      fixture.update(0);
      assertEquals("second", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());
      fixture.now += .02;
      good[8] = 1;
      poor[6] = 150;
      fixture.heading(poor);
      fixture.publish("second", "botpose_wpiblue", good, fixture.now);
      fixture.update(0);
      assertEquals("second", fixture.reader.getHeadingMeasurement().orElseThrow().cameraName());
    }
  }
}
