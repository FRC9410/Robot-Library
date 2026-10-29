package frc.powerlib.vision;

import edu.wpi.first.math.Matrix;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.numbers.N1;
import edu.wpi.first.math.numbers.N3;
import frc.powerlib.health.HealthChecks;
import frc.powerlib.vision.LimelightVision.HeadingMeasurement;
import frc.powerlib.vision.LimelightVision.Measurement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.DoubleFunction;

/** Keeps accepted vision updates in capture order when the two camera pipelines have different delays. */
public final class VisionMeasurementFusion {
  @FunctionalInterface
  public interface Estimator {
    void add(Pose2d pose, double timestampSeconds, Matrix<N3, N1> standardDeviations);
  }

  private record Sample(Pose2d pose, double timestamp, Matrix<N3, N1> deviations, boolean heading) {}
  private final double maxAgeSeconds;
  private final DoubleFunction<Optional<Pose2d>> history;
  private final Estimator estimator;
  private final ArrayList<Sample> samples = new ArrayList<>();
  private double resetCutoff = Double.NEGATIVE_INFINITY;
  private final Map<String, Double> positionTimestamps = new HashMap<>();
  private final Map<String, Double> headingTimestamps = new HashMap<>();
  private double headingErrorDegrees = Double.NaN;
  private String status = "Waiting for vision";

  /** All timestamps, including the history callback, use FPGA seconds. */
  public VisionMeasurementFusion(double maxAgeSeconds, DoubleFunction<Optional<Pose2d>> history,
      Estimator estimator) {
    if (!Double.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
      throw new IllegalArgumentException("maxAgeSeconds must be positive and finite");
    }
    this.maxAgeSeconds = maxAgeSeconds;
    this.history = Objects.requireNonNull(history);
    this.estimator = Objects.requireNonNull(estimator);
  }

  public String status() { return status; }
  /** Capture-time error from the last heading attempt; NaN when no comparison was possible. */
  public double headingErrorDegrees() { return headingErrorDegrees; }
  /** Independent camera pipelines may deliver fresh captures in different orders. */
  public boolean isNewPosition(Measurement measurement) {
    double timestamp = measurement.timestampSeconds();
    return Double.isFinite(timestamp) && timestamp > resetCutoff
        && timestamp > positionTimestamps.getOrDefault(measurement.cameraName(), Double.NEGATIVE_INFINITY);
  }
  public boolean isNewHeading(HeadingMeasurement measurement) {
    double timestamp = measurement.timestampSeconds();
    return Double.isFinite(timestamp) && timestamp > resetCutoff
        && timestamp > headingTimestamps.getOrDefault(measurement.cameraName(), Double.NEGATIVE_INFINITY);
  }

  public boolean addPosition(Measurement measurement, double now) {
    return addPosition(measurement, now, isNewPosition(measurement)
        ? history.apply(measurement.timestampSeconds()).orElse(null) : null);
  }

  /** Reuses the capture-time pose already sampled for position filtering. */
  public boolean addPosition(Measurement measurement, double now, Pose2d capturePose) {
    if (!isNewPosition(measurement)) {
      status = "Repeated or out-of-order position"; return false;
    }
    if (!add(new Sample(measurement.pose(), measurement.timestampSeconds(),
        measurement.standardDeviations(), false), now, capturePose)) return false;
    positionTimestamps.put(measurement.cameraName(), measurement.timestampSeconds());
    status = "Position applied";
    return true;
  }

  public boolean addHeading(HeadingMeasurement measurement, double now, double maxErrorDegrees) {
    headingErrorDegrees = Double.NaN;
    if (!isNewHeading(measurement)) {
      status = "Repeated or out-of-order heading"; return false;
    }
    var historical = history.apply(measurement.timestampSeconds());
    if (historical.isEmpty()) { status = "Capture pose unavailable"; return false; }
    headingErrorDegrees = measurement.errorDegrees(historical.get());
    if (!HeadingMeasurement.isErrorAllowed(headingErrorDegrees, maxErrorDegrees)) {
      status = "Heading error exceeds limit"; return false;
    }
    if (!add(new Sample(measurement.pose(), measurement.timestampSeconds(),
        measurement.standardDeviations(), true), now, historical.get())) return false;
    headingTimestamps.put(measurement.cameraName(), measurement.timestampSeconds());
    status = "Independent heading applied";
    return true;
  }

  /** Call after a complete pose reset; pre-reset images must not undo it. */
  public void resetPose(double now) {
    samples.clear();
    resetCutoff = now;
    positionTimestamps.clear();
    headingTimestamps.clear();
  }

  private boolean add(Sample sample, double now, Pose2d capturePose) {
    if (!HealthChecks.finitePose(sample.pose()) || !HealthChecks.isFresh(now - sample.timestamp(), maxAgeSeconds)) {
      status = "Rejected stale, future or invalid measurement"; return false;
    }
    if (!HealthChecks.finitePose(capturePose)) {
      status = "Capture pose unavailable"; return false;
    }
    samples.removeIf(previous -> previous.timestamp() < now - maxAgeSeconds);
    int index = 0;
    while (index < samples.size() && samples.get(index).timestamp() <= sample.timestamp()) index++;
    samples.add(index, sample);
    // A delayed update invalidates the estimator's later vision updates. Reapply
    // only those later samples, at their original times and original weights.
    for (int i = index; i < samples.size(); i++) {
      var pending = samples.get(i);
      // Reuse the capture pose already checked above; later replayed samples need fresh history.
      var historical = i == index ? capturePose : history.apply(pending.timestamp()).orElse(null);
      if (historical == null) continue;
      Pose2d pose = pending.heading()
          ? new Pose2d(historical.getTranslation(), pending.pose().getRotation())
          : new Pose2d(pending.pose().getTranslation(), historical.getRotation());
      estimator.add(pose, pending.timestamp(), pending.deviations());
    }
    return true;
  }
}
