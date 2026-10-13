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

  @Test public void headingConfigurationRejectsInvalidLimits() {
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0, 4, 0.2, 45, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, Double.NaN, 0.2, 45, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, -0.2, 45, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, 0.2, 0, 15, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, 0.2, 45, 181, 0.2));
    assertThrows(IllegalArgumentException.class, () -> new LimelightHeadingConfig(0.3, 4, 0.2, 45, 15, 1.1));
  }
}
