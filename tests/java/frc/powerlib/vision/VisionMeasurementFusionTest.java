package frc.powerlib.vision;

import static org.junit.Assert.*;

import edu.wpi.first.math.VecBuilder;
import edu.wpi.first.math.estimator.SwerveDrivePoseEstimator;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.SwerveDriveKinematics;
import edu.wpi.first.math.kinematics.SwerveDriveOdometry;
import edu.wpi.first.math.kinematics.SwerveModulePosition;
import edu.wpi.first.math.interpolation.TimeInterpolatableBuffer;
import frc.powerlib.configs.LimelightHeadingConfig;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import frc.powerlib.vision.LimelightVision.Measurement;
import java.util.Arrays;
import java.util.Optional;
import org.junit.Test;

public class VisionMeasurementFusionTest {
  @Test public void slowerHeadingCameraCanTakeOverWithoutLosingCaptureOrderOrResetCutoffs() {
    var fixture = new Fixture();
    var fast = new HeadingMeasurement("fast", new Pose2d(2, 3, Rotation2d.fromDegrees(20)), 9.98, .35, 2);
    var slow = new HeadingMeasurement("slow", new Pose2d(2, 3, Rotation2d.kZero), 9.91, .35, 2);
    assertTrue(fixture.fusion.addHeading(fast, 10, 180));
    assertTrue(fixture.fusion.addHeading(slow, 10, 180));
    int applied = fixture.updates;
    assertFalse(fixture.fusion.addHeading(slow, 10, 180));
    assertFalse(fixture.fusion.addHeading(new HeadingMeasurement("slow", slow.pose(), 9.90, .35, 2), 10, 180));
    assertEquals(applied, fixture.updates);
    for (int i = 1; i <= 80; i++) {
      double now = 10 + i * .02;
      fixture.observe(now);
      assertTrue(fixture.fusion.addHeading(new HeadingMeasurement("slow", slow.pose(), now - .09, .35, 2), now, 180));
    }
    assertEquals(0, fixture.estimator.getEstimatedPosition().getRotation().getDegrees(), .01);
    fixture.fusion.resetPose(11.6);
    assertFalse(fixture.fusion.addHeading(new HeadingMeasurement("unseen", slow.pose(), 11.59, .35, 2), 11.62, 180));
    fixture.fusion.resetPose(11.62);
    assertFalse(fixture.fusion.addHeading(new HeadingMeasurement("unseen", slow.pose(), 11.61, .35, 2), 11.64, 180));
  }

  @Test public void freshSlowerCameraCanCorrectAfterFasterFallbackWithoutReplayingItsOwnFrames() {
    var fixture = new Fixture();
    var fallback = new Measurement("fallback", new Pose2d(2, 3, Rotation2d.kZero), 9.98, 2, 3, .45);
    var better = new Measurement("better", new Pose2d(4, 3, Rotation2d.kZero), 9.94, 2, 1.5, .075);
    assertTrue(fixture.fusion.addPosition(fallback, 10));
    assertTrue(fixture.fusion.addPosition(better, 10));
    assertTrue(fixture.estimator.getEstimatedPosition().getX() > 2.5);
    int applied = fixture.updates;
    assertFalse(fixture.fusion.addPosition(better, 10));
    assertFalse(fixture.fusion.addPosition(new Measurement("better", better.pose(), 9.93, 2, 1.5, .075), 10));
    assertEquals(applied, fixture.updates);
    fixture.fusion.resetPose(10);
    assertFalse(fixture.fusion.addPosition(new Measurement("new-camera", better.pose(), 9.99, 2, 1.5, .075), 10.02));
  }
  private static final class Fixture {
    final SwerveModulePosition[] modules = new SwerveModulePosition[4];
    final SwerveDriveKinematics kinematics;
    final SwerveDrivePoseEstimator estimator;
    final VisionMeasurementFusion fusion;
    int updates;

    Fixture() {
      Arrays.setAll(modules, i -> new SwerveModulePosition());
      kinematics = new SwerveDriveKinematics(new Translation2d(.3, .3), new Translation2d(.3, -.3),
          new Translation2d(-.3, .3), new Translation2d(-.3, -.3));
      estimator = new SwerveDrivePoseEstimator(kinematics, Rotation2d.kZero, modules,
          new Pose2d(2, 3, Rotation2d.fromDegrees(90)), VecBuilder.fill(.1, .1, .1), VecBuilder.fill(1, 1, 1));
      for (int i = 0; i <= 50; i++) observe(9 + i * .02);
      fusion = new VisionMeasurementFusion(.5, estimator::sampleAt, (pose, timestamp, deviations) -> {
        updates++;
        estimator.addVisionMeasurement(pose, timestamp, deviations);
      });
    }

    void observe(double now) { estimator.updateWithTime(now, Rotation2d.kZero, modules); }
  }

  private static Measurement position(double timestamp) {
    // An MT2 yaw must never undo the independent heading correction.
    return new Measurement("position", new Pose2d(4, 3, Rotation2d.fromDegrees(90)), timestamp, 2, 2, .2);
  }

  private static HeadingMeasurement heading(double timestamp) {
    return new HeadingMeasurement("heading", new Pose2d(12, 7, Rotation2d.kZero), timestamp,
        LimelightHeadingConfig.DEFAULT.headingStdDevRadians());
  }

  @Test public void bothAxesConvergeWithoutOvershootForEitherLatencyOrder() {
    for (double[] delays : new double[][] {{.02, .02}, {.1, .02}, {.02, .1}, {.3, .02}}) {
      var fixture = new Fixture();
      for (int i = 1; i <= 80; i++) {
        double now = 10 + i * .02;
        fixture.observe(now);
        var capturePose = fixture.estimator.sampleAt(now - delays[0]).orElseThrow();
        assertTrue(fixture.fusion.addPosition(position(now - delays[0]), now, capturePose));
        assertTrue(fixture.fusion.addHeading(heading(now - delays[1]), now, 180));
        var pose = fixture.estimator.getEstimatedPosition();
        assertTrue("Position overshot with delay " + delays[0], pose.getX() <= 4 + 1e-8);
        assertEquals(3, pose.getY(), 1e-8);
      }
      var pose = fixture.estimator.getEstimatedPosition();
      assertEquals(4, pose.getX(), 1e-6);
      assertEquals(0, pose.getRotation().getDegrees(), 1e-5);
    }
  }

  @Test public void duplicateAndOutOfOrderChecksAreIndependentPerAxis() {
    var fixture = new Fixture();
    assertTrue(fixture.fusion.addPosition(position(9.9), 10));
    assertTrue(fixture.fusion.addHeading(heading(9.98), 10, 180));
    assertTrue(fixture.fusion.addPosition(position(9.92), 10));
    int count = fixture.updates;
    assertFalse(fixture.fusion.addPosition(position(9.92), 10));
    assertFalse(fixture.fusion.addHeading(heading(9.97), 10, 180));
    assertEquals(count, fixture.updates);
  }

  @Test public void suppliedCapturePoseSupportsFusionWithoutResamplingAndStillRejectsBadFrames() {
    var fixture = new Fixture();
    // The filter already owns this sample; no second history lookup is needed for this update.
    var fusion = new VisionMeasurementFusion(.5, timestamp -> Optional.empty(),
        fixture.estimator::addVisionMeasurement);
    var capture = fixture.estimator.sampleAt(9.98).orElseThrow();
    assertFalse(fusion.addPosition(position(9.98), 10, null));
    assertFalse(fusion.addPosition(position(9.98), 10,
        new Pose2d(Double.NaN, 3, Rotation2d.kZero)));
    assertFalse(fusion.addPosition(position(9), 10, capture));
    assertFalse(fusion.addPosition(position(11), 10, capture));
    assertTrue(fusion.addPosition(position(9.98), 10, capture));
    assertTrue(fixture.estimator.getEstimatedPosition().getX() > 2);
    assertEquals(3, fixture.estimator.getEstimatedPosition().getY(), 1e-8);
    assertEquals(90, fixture.estimator.getEstimatedPosition().getRotation().getDegrees(), 1e-8);
    assertFalse(fusion.addPosition(position(9.98), 10, capture));
  }

  @Test public void headingDiagnosticsUseTheCapturePoseAndClearWhenNoComparisonIsPossible() {
    var fixture = new Fixture();
    assertTrue(Double.isNaN(fixture.fusion.headingErrorDegrees()));
    assertFalse(fixture.fusion.addHeading(heading(9.98), 10, 45));
    assertEquals(-90, fixture.fusion.headingErrorDegrees(), 1e-9);
    assertTrue(fixture.fusion.addHeading(heading(9.98), 10, 180));
    assertEquals(-90, fixture.fusion.headingErrorDegrees(), 1e-9);
    assertFalse(fixture.fusion.addHeading(heading(9.98), 10, 180));
    assertTrue(Double.isNaN(fixture.fusion.headingErrorDegrees()));
    var noHistory = new VisionMeasurementFusion(.5, timestamp -> Optional.empty(),
        (pose, timestamp, deviations) -> fail());
    assertFalse(noHistory.addHeading(heading(9.98), 10, 180));
    assertTrue(Double.isNaN(noHistory.headingErrorDegrees()));
  }

  @Test public void delayedMeasurementsPreserveInterveningRobotTravelAndRotation() {
    var fixture = new Fixture();
    var truth = new SwerveDriveOdometry(fixture.kinematics, Rotation2d.kZero, fixture.modules,
        new Pose2d(4, 3, Rotation2d.kZero));
    var history = TimeInterpolatableBuffer.<Pose2d>createBuffer(1.5);
    for (int i = 0; i <= 50; i++) history.addSample(9 + i * .02, truth.getPoseMeters());
    for (int i = 1; i <= 100; i++) {
      double now = 10 + i * .02;
      var gyro = Rotation2d.fromDegrees(i * .5);
      for (var module : fixture.modules) module.distanceMeters = i * .02;
      history.addSample(now, truth.update(gyro, fixture.modules));
      fixture.estimator.updateWithTime(now, gyro, fixture.modules);
      var position = history.getSample(now - .1).orElseThrow();
      var heading = history.getSample(now - .02).orElseThrow();
      assertTrue(fixture.fusion.addPosition(new Measurement("camera", position, now - .1, 2, 2, .2), now));
      assertTrue(fixture.fusion.addHeading(new HeadingMeasurement("camera", heading, now - .02,
          Math.toRadians(20)), now, 180));
    }
    var actual = fixture.estimator.getEstimatedPosition();
    assertEquals(truth.getPoseMeters().getX(), actual.getX(), 1e-4);
    assertEquals(truth.getPoseMeters().getY(), actual.getY(), 1e-4);
    assertEquals(0, actual.getRotation().minus(truth.getPoseMeters().getRotation()).getDegrees(), 1e-4);
  }

  @Test public void manualPoseResetRejectsAllPreResetImages() {
    var fixture = new Fixture();
    fixture.estimator.resetPosition(Rotation2d.kZero, fixture.modules,
        new Pose2d(4, 3, Rotation2d.kZero));
    fixture.fusion.resetPose(10);
    assertFalse(fixture.fusion.addPosition(position(9.99), 10));
    assertFalse(fixture.fusion.addHeading(heading(9.99), 10, 180));
    fixture.observe(10.04);
    assertTrue(fixture.fusion.addPosition(position(10.02), 10.04));
    assertEquals(0, fixture.estimator.getEstimatedPosition().getRotation().getDegrees(), 1e-8);
  }

  @Test public void headingLimitUsesBothTranslationAndRotation() {
    var config = LimelightHeadingConfig.DEFAULT;
    assertEquals(180, config.headingErrorLimitDegrees(0, 0), 0);
    assertEquals(180, config.headingErrorLimitDegrees(.05, 5), 0);
    assertEquals(180, config.headingErrorLimitDegrees(-.05, -5), 0);
    assertEquals(45, config.headingErrorLimitDegrees(.050001, 0), 0);
    assertEquals(45, config.headingErrorLimitDegrees(0, 5.000001), 0);
    assertEquals(45, config.headingErrorLimitDegrees(-1, -10), 0);
    assertTrue(Double.isNaN(config.headingErrorLimitDegrees(Double.NaN, 0)));
    assertTrue(Double.isNaN(config.headingErrorLimitDegrees(0, Double.POSITIVE_INFINITY)));
  }

  @Test public void movingHeadingLimitRejectsLargeErrorsAndAcceptsTheBoundary() {
    var config = LimelightHeadingConfig.DEFAULT;
    for (double[] motion : new double[][] {{1, 0}, {0, 10}}) {
      double limit = config.headingErrorLimitDegrees(motion[0], motion[1]);
      var fixture = new Fixture(); // Starts at 90 degrees.
      assertFalse(fixture.fusion.addHeading(heading(9.98), 10, limit));
      var tooFar = new HeadingMeasurement("heading",
          new Pose2d(2, 3, Rotation2d.fromDegrees(44.99)), 9.98, config.headingStdDevRadians());
      assertFalse(fixture.fusion.addHeading(tooFar, 10, limit));
      var boundary = new HeadingMeasurement("heading",
          new Pose2d(2, 3, Rotation2d.fromDegrees(45)), 9.98, config.headingStdDevRadians());
      assertTrue(fixture.fusion.addHeading(boundary, 10, limit));
      assertTrue(fixture.estimator.getEstimatedPosition().getRotation().getDegrees() < 90);
    }
  }

  @Test public void unrestrictedHeadingFusionAcceptsLargeAngularDisagreement() {
    var fixture = new Fixture(); // Starts at 90 degrees.
    assertTrue(fixture.fusion.addHeading(heading(9.98), 10));
    assertEquals(-90, fixture.fusion.headingErrorDegrees(), 1e-9);
    assertTrue(fixture.estimator.getEstimatedPosition().getRotation().getDegrees() < 90);
  }

  @Test public void stationaryHeadingLimitAcceptsOppositeHeadingAndRejectsInvalidMotion() {
    var fixture = new Fixture(); // Starts at 90 degrees.
    var config = LimelightHeadingConfig.DEFAULT;
    var opposite = new HeadingMeasurement("heading",
        new Pose2d(2, 3, Rotation2d.fromDegrees(-90)), 9.98, config.headingStdDevRadians());
    assertFalse(fixture.fusion.addHeading(opposite, 10, config.headingErrorLimitDegrees(Double.NaN, 0)));
    assertTrue(fixture.fusion.addHeading(opposite, 10, config.headingErrorLimitDegrees(0, 0)));
  }

  @Test public void headingLimitsAreConfigurableAndLegacyConstructorKeepsOneLimit() {
    var config = new LimelightHeadingConfig(.3, 4, .2, 45, 120, 30, .2);
    assertEquals(120, config.headingErrorLimitDegrees(0, 0), 0);
    assertEquals(30, config.headingErrorLimitDegrees(1, 0), 0);
    var legacy = new LimelightHeadingConfig(.3, 4, .2, 45, 15, .2);
    assertEquals(15, legacy.headingErrorLimitDegrees(0, 0), 0);
    assertEquals(15, legacy.headingErrorLimitDegrees(1, 0), 0);
    for (double invalid : new double[] {0, -1, 181, Double.NaN, Double.POSITIVE_INFINITY}) {
      assertThrows(IllegalArgumentException.class,
          () -> new LimelightHeadingConfig(.3, 4, .2, 45, 180, invalid, .2));
    }
  }

  @Test public void staleFutureMissingHistoryAndConfiguredHeadingLimitsStillReject() {
    var fixture = new Fixture();
    assertEquals(180, LimelightHeadingConfig.DEFAULT.maxHeadingErrorDegrees(), 0);
    assertFalse(fixture.fusion.addHeading(heading(9.98), 10, 15));
    assertTrue(fixture.fusion.addHeading(heading(9.98), 10, LimelightHeadingConfig.DEFAULT.maxHeadingErrorDegrees()));
    assertFalse(fixture.fusion.addPosition(position(9), 10));
    assertFalse(fixture.fusion.addPosition(position(11), 10));
    var noHistory = new VisionMeasurementFusion(.5, timestamp -> Optional.empty(), (pose, timestamp, deviations) -> fail());
    assertFalse(noHistory.addPosition(position(9.98), 10));
    assertFalse(noHistory.addHeading(heading(9.98), 10, 180));
    assertThrows(IllegalArgumentException.class, () -> new VisionMeasurementFusion(0, fixture.estimator::sampleAt,
        (pose, timestamp, deviations) -> fail()));
  }
}
