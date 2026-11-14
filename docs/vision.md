# Vision

[Project README](../README.md) · [All guides](README.md)

Start by matching the camera names in Power Tool to the Limelights on your robot, then verify each camera's mounting pose, calibration and AprilTag pipeline. The detailed filtering and heading policies below explain how the starter uses those observations.

- [Camera setup](#camera-setup)
- [Position measurements](#position-measurements)
- [Heading correction and camera selection](#heading-correction-and-camera-selection)
- [Heading initialization and stationary recovery](#heading-initialization-and-stationary-recovery)
- [Using another drivetrain](#using-another-drivetrain)
- [Capture-time pose filtering](#capture-time-pose-filtering)
- [Configuration and heading readiness](#configuration-and-heading-readiness)
- [Manual pose seeding](#manual-pose-seeding)

## Camera setup

Declare your camera NetworkTables names in `VisionConstants.java`, in priority order:

```java
public static final String[] LIMELIGHT_NAMES = {
    "limelight-b", "limelight-l", "limelight-r"
};
```

The starter `Vision` subsystem handles orientation publishing, MegaTag2 position, independent
MegaTag1 heading correction, disabled-mode throttling, and Swerve pose corrections. An empty array disables camera handling. Configure each
camera's mounting pose, calibration, team number, and AprilTag pipeline in its own Limelight web UI;
names alone cannot describe mounting geometry. All measurements use blue-origin field coordinates.

### Limelight IMU assist

The starter enables IMU assist on cameras that publish `imu` and `imu_yaw_offset`. Use Limelight OS
2026.1 or newer on cameras with an internal IMU, such as the Limelight 4. Cameras without those
topics use the drivetrain's external orientation in mode `0`. Set `LIMELIGHT_IMU_ASSIST_ENABLED`
to `false` in `VisionConstants.java` to use mode `0` on every camera.
[Limelight firmware notes](https://docs.limelightvision.io/docs/docs-limelight/software-change-log)

The starter sends the drivetrain's estimated field yaw every loop. Once field heading is established,
each supported camera seeds its internal IMU in mode `1` and then switches to mode `4`, where it
continuously corrects against the robot's estimate with an assist alpha of `0.001`. The starter
resumes MegaTag2 position updates for that camera after fresh yaw telemetry agrees with the robot
within 5 degrees. It reseeds after an explicit drivetrain pose or heading reset, a camera restart,
stale IMU data, or a running heading difference over 15 degrees. MegaTag1 continues to supply independent
AprilTag heading for the drivetrain estimator.

For a bench check, log `Vision/IMU/<camera>/State`, `CameraYawDegrees`, and `HeadingErrorDegrees`.
Compare them with `Vision/Heading/EstimatedDegrees` through a turn, a pose reset, and a camera power cycle.

## Position measurements

The reusable `frc.powerlib.vision.LimelightVision` class exposes fresh position candidates ordered by
their calculated position uncertainty, then capture freshness; configured camera order breaks ties.
The starter tries each candidate until its complete position filter accepts one,
with position uncertainty `0.07 * distance^2 / tagCount` and
average tag distance below 6.25 meters. It additionally rejects malformed, non-finite, repeated,
future-dated, and stale measurements (over 0.5 seconds old, including latency). Every update consumes
all current camera frames so skipped lower-priority frames are not replayed next loop. MegaTag2
corrects X/Y and ignores its supplied heading. No LimelightHelpers file or extra vendordep is required.

## Heading correction and camera selection

The starter separately reads `botpose_wpiblue` (MegaTag1) to correct slow heading drift in the
pose estimator, without resetting the physical gyro. `VisionConstants.HEADING_CONFIG` uses
conservative defaults for normal enabled correction: at least two distinct tags, positive tag span, ambiguity at most 0.2,
average and individual tag distances at most 4 meters, total age at most 0.2 seconds, and
drivetrain angular speed at most 45 degrees/second. The default heading-error limits are 180 degrees
while stationary and 45 degrees while moving. Stationary means measured translation speed at most
0.05 m/s and yaw rate at most 5 degrees/s. `maxHeadingErrorDegrees` sets the stationary limit and
`maxMovingHeadingErrorDegrees` sets the moving limit; the six-argument constructor retains its
single limit for both conditions. Accepted observations use 20 degrees of heading
standard deviation (stored in radians) for gradual correction, while ignoring MegaTag1 X/Y.
Moving heading correction uses this normal fusion path; stationary hard recovery is described below.
Heading candidates prefer multi-tag over single-tag, then rank lower distance squared per tag,
lower maximum tag ambiguity, greater tag span, and capture freshness. Configured camera order breaks
remaining ties. This is a quality ranking, not agreement voting between cameras. If a candidate fails the
capture-time gate, estimator-history lookup, or heading-error check, the starter tries the next camera
and stops after one accepted correction. `getHeadingMeasurement()` remains a compatibility accessor
for the first candidate before those downstream checks.
After confirmation (or the first accepted moving correction), `VisionHeadingSelector` retains the selected heading camera through ordinary
frame gaps. An equally ranked or poorer camera cannot replace it simply by publishing more often.
A challenger must retain better tag geometry/quality for at least the initialization frame count
and duration (five frames over 0.25 seconds by default). Stationary handoffs also require the
camera's independent stable-heading window; single-tag recovery keeps its stricter policy.
A stale selected camera releases selection after the existing heading freshness limit; downstream
rejection or inconsistent stationary readings also release it. This preference survives automatic
heading resets and mode changes, but explicit seeds and toggling corrections clear it.
Aligned stable candidates can confirm selection without resetting heading or position history.
While stationary, a camera flagged inconsistent must rebuild its stable window before heading
corrections resume. Other eligible cameras and position updates continue during that collection.
Moving heading confirmation tracks each camera separately, so disagreement from one camera cannot
erase another camera's confirmation evidence. Stability windows restart after completion to bound
ongoing work and avoid comparing slow real yaw against an anchor retained since startup.
Heading freshness, capture-time error checks and error diagnostics are owned by `VisionMeasurementFusion`.
Position cache selection and fusion selection share one pass through the camera candidates. Accepted
positions reuse the capture-time pose sampled for filtering, and heading validation calculates the
angular error without constructing a corrected pose. Cached frames are checked again when used for a manual seed.
`VisionMeasurementFusion` tracks accepted position and heading timestamps separately for each camera,
so a faster pipeline cannot starve a qualified slower camera during a handoff. Each observation
keeps its capture timestamp and original uncertainty. When a delayed observation arrives, the helper
reapplies only the newer accepted observations within the measurement-age window, so neither pipeline
discards the other's corrections. Position observations preserve historical heading; heading observations
preserve historical X/Y. Camera rejection and large-correction evidence are tracked per camera, so a
rejected camera cannot consume another camera's frame or erase its recovery evidence.
Once heading is established, ordinary corrections continue while disabled. Test mode suppresses
automatic heading initialization, stationary heading recovery and weighted heading correction;
valid position corrections continue using the established heading. Turning pose updates off
suppresses both position and heading corrections. Camera frames are still consumed in either case.
`Vision/Heading/ErrorDegrees` and `Vision/Heading/Accepted` are
logged through CTRE SignalLogger, outside the dashboard data map. Disabled initialization below
can establish heading directly rather than waiting for gradual fusion;
validate camera mounting and these limits on the robot.

## Heading initialization and stationary recovery

Automatic heading initialization is enabled by default. To disable it, configure
`VisionConstants.java` before startup:

```java
public static final VisionHeadingInitializationConfig HEADING_INITIALIZATION_CONFIG =
    VisionHeadingInitializationConfig.DEFAULT.withEnabled(false);
```

The default multi-tag policy requires at least five distinct independent heading frames spanning 0.25 seconds,
within a two-degree spread, with vision updates enabled. Translation speed must be
at most 0.05 m/s and yaw rate at most 5 degrees/s, with drivetrain feedback at most 0.5 seconds old.
Two-or-more-tag heading frames are preferred across cameras. A stationary single-tag fallback requires
distance at most 2 m, ambiguity at most 0.05, frame age at most 100 ms, and at least ten distinct frames
spanning 0.5 seconds within a one-degree spread. Unknown single-tag quality is rejected. A single tag
can have zero tag span. Existing `HEADING_CONFIG` limits still apply if stricter. Moving heading fusion
requires at least two tags. Stationary recovery works while disabled or enabled and preserves X/Y and
raw gyro yaw. Once heading is established, hard recovery only starts for errors over 5 degrees, avoiding
repeated resets of an already-correct estimate. Each eligible camera contributes its own evidence;
the highest-ranked camera with sufficient stable evidence is selected without cross-camera averaging.
Qualified stationary single-tag observations also correct errors within the five-degree agreement
tolerance through normal weighted fusion, without resetting heading or interrupting position updates.
Qualification requires the same strict single-tag window and is cleared by motion, stale/invalid
evidence, or inconsistent observations. Multi-tag evidence alone cannot qualify a single-tag solve.

`HEADING_INITIALIZATION_CONFIG` owns the stationary speed/yaw limits and drivetrain-feedback age
for recovery and camera arbitration. The same speed/yaw policy selects the configured stationary
or moving correction limit. Setting `enabled` to false disables automatic startup initialization
and hard resets; passive stability collection and qualified camera handoffs continue, as does
normal weighted heading fusion. The robot uses the shared collector directly, without a separate
robot-side forwarding helper.

## Using another drivetrain

For another drivetrain, call the reader once per robot loop and feed its optional result to your
own pose estimator:

```java
var cameras = new LimelightVision(LIMELIGHT_NAMES);
// In the robot loop, including while pose corrections are disabled:
cameras.update(yawDegrees, pitchDegrees, rollDegrees).ifPresent(measurement -> {
  poseEstimator.addVisionMeasurement(
      measurement.pose(), measurement.timestampSeconds(), measurement.standardDeviations());
});
// Close the reader when shutting down to release NetworkTables handles.
```

## Capture-time pose filtering

The `Vision` template also applies `VisionPoseFilter`, configured through
`VisionConstants.POSE_FILTER_CONFIG`. Its field bounds come from `LocationConstants`; set those
to your season's blue-origin field dimensions. The robot-specific integration uses its own field bounds.
Starting thresholds reject pitch/roll beyond 8 degrees, require 0.15 s of continuously observed
level feedback, and restart that interval if gyro data becomes invalid/stale or loop observations
are separated by more than 0.1 s. Only images captured after the complete level interval are
eligible; delayed bump images remain rejected after landing. Heading candidates and disabled
manual pose seeds use the same capture-time gate. Reading/consuming camera frames continues
while corrections are blocked, preventing rejected frames from being replayed later.

Position candidates must be within the configured field bounds plus a 0.25 m margin, with
absolute robot-origin height no more than 0.5 m. `Measurement.heightMeters()` preserves the
camera's Z coordinate; the existing six-argument planar constructor remains supported.
For enabled fusion, the filter compares camera position with estimator history at image capture
time. Missing history rejects the frame. Corrections exceeding 1 m require at least three distinct
capture times spanning 0.1 s, with correction vectors agreeing within 0.25 m of their anchor.
Comparing vectors rather than absolute positions allows recovery while the robot moves.
Inconsistent/invalid samples, tilt, missing gyro observations and long camera gaps clear recovery
evidence. A normal correction clears it too. Repeated observations can therefore recover genuine
wheel-slip error without accepting a single large outlier or permanently rejecting large offsets.

Fusion uses `measurement.standardDeviations()` so distance, tag count and uncertainty scaling
reach the estimator; the MT2 heading remains ignored. `Vision/Position/Status` logs the gate/recovery
state without adding dashboard fields. These settings are starting values to test on hardware.
Agreement does not prove a camera's calibration or tag map is correct; check mounting pose, field
map and gyro signs. Low-level `LimelightVision` readers expose measurements but do not apply
robot-specific filtering automatically: call `observe()` every loop, `plausible()` for cached/manual
seeds and `acceptPosition()` with capture-time estimator history before fusion. Adopt updated
`Vision`, `Swerve`, and `VisionConstants` templates together in an existing robot project.

## Configuration and heading readiness

`LimelightVisionConfig` exposes the base position uncertainty, maximum tag distance, and maximum
measurement age. `setMeasurementStdDevScale()` accepts robot-specific uncertainty adjustments,
such as trusting vision more during wheel slip; wheel-slip detection is left to the robot.
The three-argument `update()` above remains position-only. For heading candidates, construct with
`new LimelightVision(positionConfig, headingConfig, cameraNames)`, call
`update(yawDegrees, pitchDegrees, rollDegrees, yawRateDegreesPerSecond)`, and then read
`getHeadingMeasurements()`. Use `getPositionMeasurements()` for downstream position fallback; both read-only
views are valid until the next update. The starter supplies accepted observations to
`VisionMeasurementFusion`, using FPGA seconds for its history and estimator callbacks.
The five-argument `update(..., allowSingleTagHeading)` overload enables the single-tag fallback;
the robot template permits this while disabled or stationary, with the stricter quality and stability policy above.
`LimelightHeadingConfig` contains the uncertainty, distance, age, angular-rate, heading-error and
ambiguity limits. In CTRE Swerve, `samplePoseAt()` needs `Utils.fpgaToCurrentTime()`; the
Swerve wrapper already performs that conversion for `addVisionMeasurement()`.
The starter enables corrections while disabled, during autonomous and during teleop. Call
`stateMachine.vision.setShouldUpdatePose(false)` to disable corrections, and `true` to restore them.
With heading initialization enabled, automatic position fusion initially waits for a trustworthy heading.
Disabled MT1 initialization or an explicit pose/heading reset establishes it immediately. While enabled,
normal multi-tag heading fusion can also release the guard after capture-time heading error stays within
5 degrees for at least the configured frame count and
duration (five distinct accepted frames spanning 0.25 seconds). The robot may move during this agreement
check; moving heading correction remains gradual. Stationary recovery can reset heading directly after
the stable evidence window completes. Rejected candidate batches, excessive error, stale
frames and long gaps restart the agreement window. No timeout blindly trusts the current heading.
`Swerve` tracks explicit `resetPose()` and `resetRotation()` calls, including autonomous pose seeds;
`Vision` notices resets made during its lifetime on the next loop. Normal estimator corrections do not
count as resets. `isHeadingEstablished()` exposes the processed readiness state. After heading becomes
trusted, the starter discards MT2 frames captured before publishing the corrected orientation, including
delayed frames received later. The corrections-off switch still blocks fusion. Turning heading
initialization off explicitly trusts the configured drivetrain heading and skips this startup guard.
The enabled-recovery agreement tolerance is independent of disabled initialization's 2-degree
heading-spread limit; changing one does not change the other.
Stationary initialization keeps separate sample windows for each camera. Selecting another camera
does not erase evidence from a still-fresh camera or combine their headings into one average.
Motion clears all windows; stale or inconsistent observations discard the affected camera's evidence.
Normal position acceptance clears only that camera's large-correction window; fallback acceptance cannot
erase another camera's consistent recovery evidence. Motion/tilt safety events and explicit resets still
clear all relevant recovery windows.

## Manual pose seeding

`stateMachine.vision.seedFromFreshVision()` explicitly resets drivetrain translation from
the last plausible MegaTag2 measurement while disabled, even if automatic fusion rejected its correction
size or lacked estimator history. It uses a fresh independent MegaTag1
heading when available (including the disabled single-tag fallback); otherwise it preserves the drivetrain heading. Frames captured before
the reset cannot subsequently undo it. It returns `false` when enabled,
when no plausible frame is cached, or when the frame is stale, future-dated, or invalid.
The freshness limit comes from `Constants.Vision.CONFIG.maxMeasurementAgeSeconds()`.
Vision keeps reading and caching plausible frames while normal pose corrections are disabled.
`hasFreshMeasurement()` reports this manual-seed freshness for compatibility. Use
`hasFreshAcceptedMeasurement()` for dashboard accepted-vision status or shooting confidence: it checks
the most recent position frame actually fused or explicitly seeded, and rejected frames cannot refresh it.

When integrating a release into an existing robot, review `Vision`, `VisionConstants`,
and `StateMachine` together; the Vision constructor takes the drivetrain.

Related: [Power Tool camera settings](power-tool.md#settings), [Java telemetry](java-programming.md#telemetry-logging), and [Log Viewer](log-viewer.md).
