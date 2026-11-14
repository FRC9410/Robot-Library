package frc.powerlib.vision;

import edu.wpi.first.networktables.DoubleArraySubscriber;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.PubSubOption;

/** Seeds one Limelight and gates its MegaTag2 positions until its assisted yaw is verified. */
final class LimelightImuSync implements AutoCloseable {
  private static final double MAX_IMU_AGE_SECONDS = 0.25;
  private static final double SEED_SECONDS = 0.2;
  private static final double ASSIST_SETTLE_SECONDS = 0.1;
  private static final double VERIFY_TIMEOUT_SECONDS = 0.5;
  private static final double SEED_AGREEMENT_DEGREES = 5;
  private static final double RUNNING_AGREEMENT_DEGREES = 15;

  private enum State {
    EXTERNAL(0), SEEDING(1), VERIFYING(4), ASSISTED(4);

    final int mode;

    State(int mode) { this.mode = mode; }
  }

  private final DoublePublisher mode;
  private final DoubleArraySubscriber imu;
  private final DoubleSubscriber yawOffset;
  private final DoubleSubscriber heartbeat;
  private State state = State.EXTERNAL;
  private double stateSince;
  private boolean reseed;
  private long lastHeartbeatTimestamp;
  private double lastHeartbeat = Double.NaN;
  private double cameraYaw = Double.NaN;
  private double headingError = Double.NaN;

  LimelightImuSync(NetworkTable table, DoublePublisher mode) {
    this.mode = mode;
    imu = table.getDoubleArrayTopic("imu").subscribe(new double[0],
        PubSubOption.keepDuplicates(true), PubSubOption.periodic(0.02));
    // This diagnostic was added in LLOS 2026.1, which fixed the mode 1 -> 4 transition.
    yawOffset = table.getDoubleTopic("imu_yaw_offset").subscribe(Double.NaN);
    heartbeat = table.getDoubleTopic("hb").subscribe(Double.NaN, PubSubOption.periodic(0.02));
  }

  void requestReseed() {
    if (state != State.EXTERNAL) reseed = true;
  }

  void update(double now, double yawDegrees, double yawRateDegreesPerSecond, boolean trustedOrientation) {
    var sample = imu.getAtomic();
    double sampleTime = sample.timestamp / 1e6;
    double age = now - sampleTime;
    boolean fresh = sample.timestamp > 0 && age >= 0 && age <= MAX_IMU_AGE_SECONDS
        && sample.value.length >= 10 && Double.isFinite(sample.value[0]) && Double.isFinite(sample.value[3]);
    boolean restarted = cameraRestarted();
    cameraYaw = fresh ? sample.value[0] : Double.NaN;
    // Compare the camera's reported robot yaw with our field yaw at the sample time.
    double reference = yawDegrees - yawRateDegreesPerSecond * age;
    headingError = fresh && trustedOrientation ? Math.IEEEremainder(cameraYaw - reference, 360) : Double.NaN;

    if (state == State.EXTERNAL) {
      if (trustedOrientation && fresh && Double.isFinite(yawOffset.get())) transition(State.SEEDING, now);
      return;
    }

    if (reseed || restarted || (!trustedOrientation && state != State.SEEDING)) {
      transition(State.SEEDING, now);
    } else if (state == State.SEEDING && trustedOrientation && fresh && sampleTime > stateSince
        && now - stateSince >= SEED_SECONDS) {
      transition(State.VERIFYING, now);
    } else if (state == State.VERIFYING) {
      if (sampleTime >= stateSince + ASSIST_SETTLE_SECONDS && Math.abs(headingError) <= SEED_AGREEMENT_DEGREES) {
        transition(State.ASSISTED, now);
      } else if (now - stateSince >= VERIFY_TIMEOUT_SECONDS) {
        transition(State.SEEDING, now);
      }
    } else if (state == State.ASSISTED && (!fresh || Math.abs(headingError) > RUNNING_AGREEMENT_DEGREES)) {
      transition(State.SEEDING, now);
    }
  }

  LimelightVision.ImuStatus status(String cameraName) {
    return new LimelightVision.ImuStatus(cameraName, state.name(), cameraYaw, headingError);
  }

  boolean acceptsPosition(double captureTime) {
    return state == State.EXTERNAL || (state == State.ASSISTED && !reseed && captureTime > stateSince);
  }

  private boolean cameraRestarted() {
    var sample = heartbeat.getAtomic();
    if (sample.timestamp <= lastHeartbeatTimestamp || !Double.isFinite(sample.value)) return false;
    boolean restarted = sample.value < lastHeartbeat;
    lastHeartbeat = sample.value;
    lastHeartbeatTimestamp = sample.timestamp;
    return restarted;
  }

  private void transition(State next, double now) {
    // Reissue mode 1 on a reboot or reset even if we were already seeding.
    if (next != State.ASSISTED) mode.set(next.mode);
    state = next;
    stateSince = now;
    reseed = false;
  }

  @Override
  public void close() {
    imu.close();
    yawOffset.close();
    heartbeat.close();
  }
}
