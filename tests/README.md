# Library validation and review

Run these checks from the Robot-Library root in PowerShell 7. They write fixtures and logs under ignored `build/` directories. Java checks need the installed WPILib 2026 JDK/Maven files and cached Phoenix/vendor dependencies. Dashboard checks need its npm dependencies installed.

```powershell
./tests/run-library-checks.ps1
./tests/state-machine-check.ps1
./tests/generator-checks.ps1
./tests/generated-robot-check.ps1
./tests/app-generation-check.ps1
Push-Location powerlib-dashboard
try {
    node scripts/telemetry-buffer-check.mjs --java-fixture
    node scripts/dashboard-model-check.mjs
    node scripts/config-check.mjs
    node scripts/subscription-check.mjs
    node scripts/tuning-check.mjs
    node scripts/log-check.mjs
    node scripts/mechanism-tuning-check.mjs
    npm run build
} finally { Pop-Location }
```

For the isolated mechanism UI check, run
`powerlib-dashboard/node_modules/electron/dist/electron.exe powerlib-dashboard/scripts/mechanism-tuning-electron-check.cjs`
from the repository root. It uses simulated telemetry and captures all
publications in memory without connecting to a robot.

`powerlib-dashboard/node_modules/electron/dist/electron.exe powerlib-dashboard/scripts/networktables-drawer-electron-check.cjs`
checks the production View menu/preload with an in-memory NT client: right-side drawer layout, filtering, menu/close/Escape toggles, full-topic subscription cleanup, and Logs navigation, window sizing and preservation across tab switches. Robot connections are blocked.

The generated-robot check runs the actual installer in an isolated fixture, compiles the full robot template with real WPILib/vendor jars, runs the shared Java source editor, verifies initializer-only edits and unchanged custom source, and compiles all four mechanism types. Supply `-GradleExecutable` if Gradle 8.11 is outside the normal WPILib cache. This validates Java compilation, not deployment to a roboRIO.

The app-generation check uses the actual Config wizard and Save Tuned Values dialog with the production preload, IPC handlers, direct Java saves, and Build Robot command. In a disposable robot it creates all four mechanism types, edits a subsystem name, configures leader/follower motors and a CANcoder, adds/edits/deletes states and cameras, and saves field dimensions locally. It saves 60 deterministic tunable samples (mechanism, sensor, default position, torque feedforward, drivetrain, localization, and custom constants), checks the generated Java values and registrations, builds twice, and verifies that repeat builds preserve the files and configuration. Its hidden window disables background timer throttling so form interactions finish within the check's timeout. Robot connections are blocked; no running robot or existing robot project is modified. Logs and `result.json` stay under `build/app-generation-check-*`.

The Config desktop check covers state deletion confirmation, cancellation and failed
saves. The app-generation check confirms deletion of a team-edited Java state,
verifies its handler and registration are removed, and rebuilds the robot. Source
checks verify that unconfirmed deletion preserves custom code and that references
elsewhere still block confirmed deletion.

The state-machine check runs the template state logic and real WPILib instant command
with hardware stubs and a state handler produced by the shared source editor. It checks
generated handler execution, Idle-last registration, first-match priority,
guarded transitions, retrying pending requests, skipping the search when already in the
requested state, continued active execution, returning to Idle and request/actual separation.

| Step | Change reviewed | Regression coverage |
| --- | --- | --- |
| 1 | One complete startup motor configuration preserves inversion, neutral mode, feedback, gains and limits | MotorConfigurationTest |
| 2 | Relative control caching tracks mode and invalidates after reset/stop | RelativeControlTest |
| 3 | Installer and generator share the dashboard template; migration retains custom code and Unicode | Inventory, migration, locale/precision checks and full generated robot compilation |
| 4 | Java snapshots and dashboard decoding agree on names, nulls and typed poses; malformed frames retain valid readings and show a diagnostic | TelemetryContractTest, Java-to-TypeScript fixture and telemetry-buffer checks |
| 5 | Running detection uses finite absolute velocity and handles missing/empty motors | RunningStateTest |
| 6 | Runtime configuration runs on a serial worker, coalesces requests, checks status, acknowledges success and delays retries | ConfigurationQueueTest |
| 7 | Normal subscriptions request relevant values; the raw explorer subscribes on demand; selected React snapshots remain stable | Subscription, cleanup, custom-camera discovery and topic-view checks |
| 8 | Reuse control requests and log names; serialize once per frame; throttle tuning and avoid unchanged reflective writes | Java compilation, telemetry/log cadence tests and dashboard production build |
| 9 | One owned store supplies grouped and legacy reads through read-only maps; requested and actual state remain separate | SharedDataTest, state migration and template compilation |
| 10 | Injected IO avoids hardware creation; lightweight mechanism models simulate position and velocity over time | MechanismSimulationTest and full generated robot compilation |

## Runtime contracts

The follow-up quality review adds these checks without changing the vision flush or robot deploy workflow:

| Change | Benefit | Regression coverage |
| --- | --- | --- |
| Reject malformed interpolation tables, duplicate distances and nonfinite queries | Prevent silent incorrect shooter lookup results | LinearInterpolatorTest |
| Remove the always-true alliance flag from joystick calculations | Make the existing driving behavior clear | Algebraic equivalence review and full robot compilation; unknown-alliance guard and operator perspective retained |
| Validate configuration records and copy motor lists; reject invalid live settings; retain startup failure status | Fail explicitly before invalid setup and retain valid tuning | ConfigurationValidationTest, MotorConfigurationTest |
| Activate relative targets only after profile acknowledgement; hold position while pending | Prevent movement toward a new target under the wrong profile | MotionProfileSequencingTest, ConfigurationQueueTest, RelativeControlTest |
| Share gain construction and change detection; deprecate unused slowThreshold access | Reduce repeated control configuration without introducing a tuning framework | MotorConfigurationTest and generated-source compilation |

- Dashboard telemetry snapshots run every 100 ms (10 Hz). Tuning mode reconciliation, variable synchronization, mechanism/Swerve tuning, reflected constants, and the dashboard tuning display run every 200 ms (5 Hz). Apply sends a user's edit immediately; the robot reads it on the next tuning pass. Logging remains on every 20 ms robot loop (50 Hz). See [the telemetry contract](TELEMETRY-CONTRACT.md).
- Power Tool retains the switch's requested mode through transient disconnects and resends it on reconnection. While connected, it checks both `/PowerLib/Tuning/RequestedEnabled` and the robot's `/PowerLib/Tuning/Enabled` acknowledgement every 200 ms and retries mismatches. A matching requested value alone is insufficient. Changing the host/port discards the old robot's switch intent. Failed publications retry without repeating the same error notification. `tuning-check.mjs` covers reboot recovery, stale cached observations, on/off requests, delayed/failing publication, connection changes, and tuning-view refreshes; `TuningCadenceTest` verifies five updates across fifty robot loops.
- Shared data and tuning access belongs to the robot thread. Public mutable backing fields were replaced with getters and update methods. Returned maps are read-only; the legacy flat data getter returns a snapshot. Value-only updates retain previously registered units.
- Mechanism tuning configuration is asynchronous. Configuration caches update after successful acknowledgement. Configuration writes use a 50 ms timeout and failed changes retry no sooner than 500 ms while still requested. The imperative motor registration and neutral-mode helpers remain synchronous setup APIs. Relative motion profiles are selected when a new position command arrives and remain selected while it executes. Standard Motion Magic controls remain supported without adding a Phoenix Pro requirement.
- Configuration records reject nonfinite numbers, zero or out-of-range feedback ratios, negative profile parameters, invalid encoder ranges, duplicate motor IDs, follower-only lists, reversed soft limits, home outside the limits, and nonpositive tolerance. Signed feedback ratios in [-1000, 1000] are accepted. Zero cruise velocity/acceleration and empty motor lists remain accepted for their existing uses. Motor lists are copied. Invalid live tuning retains the previous accepted setting and warns when the rejected value changes; repeated unchanged invalid values do not repeat the warning. A valid edit clears the warning cache for that setting.
- `isConfigured()` records startup motor, follower and encoder setup failures. Failure remains latched until the subsystem is recreated; new position/velocity/voltage demands are blocked, while stop commands remain available. Injected IO and simulation do not require hardware setup.
- Relative `getSetpoint()` is the requested position. `getActivatedSetpoint()` is the last position sent to IO, including a temporary hold at the current position while profile configuration is pending. Success releases only the latest requested target; failure leaves it pending for retry. Stop, voltage/manual output and encoder reset cancel pending motion. Encoder reset stops the old demand before changing position coordinates. `atTargetPosition()` and `isReady()` require active, confirmed position control.
- Relative `slowThreshold` remains in the constructor and legacy import format for compatibility; its accessor is deprecated. Decreasing/equal position requests select the slow profile, and increasing requests select the normal profile. No new threshold behavior was added.
- Actual state must be updated by the robot's state controller when a transition happens; it is not inferred from requested state.
- State requests are stored per owner and arbitrated by handler registration order. The state-machine fixture covers independent requests, priority changes, guarded transitions, and skipping selection for an unchanged single request. ButtonBindingsTest verifies one action per press/release edge and stable, distinct owners for state bindings.
- AutoTest checks equivalent direct-point and path-cursor sequences, drive completion before subsequent commands, copied destinations, mixed styles, fresh command instances, subsystem requirements, interrupted drive cleanup and invalid definitions. AutoBuilderTest checks chooser registration snapshots, repeated runs, alliance filtering, defaults and existing factory registration. The fresh-install check also verifies the Auto definition class and RobotAutos starter are installed and wired, and reinstalling preserves custom robot autos without a template copy.
- HealthChecksTest covers freshness boundaries, invalid timestamps/poses, and missing feedback. ConfigurationValidationTest verifies that simulation health checks still reject failed startup configuration.
- LimelightVisionTest uses real local NetworkTables and a pose estimator to verify independent MT1 heading, unchanged MT2 weights, gradual drift correction, delayed-heading fusion that preserves newer translation and intervening rotation, timestamp/latency handling, angle wrapping, malformed/poor tag rejection, fast-turn suppression, camera priority, and consuming skipped/repeated frames. Disabled single-tag fallback tests cover quality checks, preference for multi-tag frames across cameras, stable heading initialization, and single-tag rejection during motion, with strict stationary fallback after enabling. VisionHeadingInitializerTest verifies default-enabled initialization, explicit disabling, configurable stationary limits, distinct stable frames, angle wrapping, and resets after motion or inconsistent observations. Fresh-install compilation verifies the heading configuration and robot integration are installed together. Camera calibration and correction strength still need real-robot validation.
- MotorConfigurationTest verifies optional stator limits preserve other velocity settings and reject invalid limits. The generated-robot check carries a configured limit through both velocity mechanism types, repeated saves, and compilation.
- Mechanism simulation is a deterministic control/readiness model with acceleration and soft limits. It is not a calibrated model of mechanism inertia or loads. Swerve/MapleSim integration remains separate.

VisionMeasurementFusionTest covers both latency orderings, long-delayed position updates, independent
per-axis replay checks, heading/pose resets, convergence without position overshoot, and preserving
intervening robot travel and rotation. Camera fallback tests cover simultaneous frames and preventing
invalid cameras from erasing another camera's large-correction evidence. The default heading-error
limits are 180 degrees stationary and 45 degrees moving. Tests cover translation/rotation thresholds,
the 45-degree acceptance boundary, opposite-heading stationary correction, invalid motion feedback,
custom limits and the legacy constructor. Tag quality, freshness, tilt, field bounds and height checks still apply.
Heading diagnostics also cover rejected large errors and clearing the error when history is unavailable
or a frame is repeated, so the subsystem can log the fusion result without a second history lookup.
Position fusion tests cover a supplied capture-time pose without resampling, invalid/missing history,
stale/future frames, duplicate timestamps, and both latency orderings with the supplied-pose overload.
Heading-candidate tests retain all fresh cameras in multi-tag-first order, expose a read-only view,
consume candidates once, and preserve fallback after capture-time, error-limit, or history rejection.
The SOTM robot's native Vision simulations additionally check downstream camera fallback, expiration
of accepted-vision freshness despite new rejected frames, heading-first startup at 90 degrees error,
delayed pre-seed MT2 rejection, and retaining the startup guard across an early enable transition.
VisionHeadingReadinessTest checks the configured error tolerance, distinct-frame count and elapsed
agreement window, rejection of stale/future/nonfinite observations, gaps, and resets. Native SOTM
regressions check gradual heading recovery in auto/teleop, releasing position fusion after convergence,
recognizing direct drivetrain pose/heading seeds without MT1 tags, discarding delayed pre-recovery
images, and preserving the corrections-off switch and single-tag initialization policy.
Confirmation through gradual fusion accepts the 5-degree agreement boundary; heading correction
retains the separate 180-degree stationary and 45-degree moving limits. Stationary initialization
retains its separate 2-degree multi-tag spread limit.
Camera-quality tests verify distance/tag-count ranking, ambiguity/span/freshness tie-breakers,
unchanged estimator weights, and fallback after downstream rejection. Stationary initializer tests
cover asynchronous camera cadences, independent angle averages, and preserving a stable camera's
evidence when another camera is inconsistent. The SOTM robot additionally tests stable two-tag
stationary hard recovery, preserving X/Y, avoiding repeated resets when heading is already correct,
and prohibiting hard resets during measured motion, Test mode, or corrections-off operation.

Strict single-tag regressions cover the 2 m / 0.05 ambiguity / 100 ms quality limits and the longer
ten-frame, half-second, one-degree stability window. Native regressions reproduce an unstable
top-ranked heading camera with a stable backup and a thirteen-meter correction that previously
starved because an accepted fallback cleared every camera's history. Both were verified failing
before the fixes. Continuous disabled and enabled-stationary single-tag recovery also works after
earlier initialization, without repeatedly resetting an already-correct heading.

Heading confirmation tests isolate each camera's frame history, including conflicting alternating
readings and insufficient windows that must not combine across cameras. `VisionHeadingSelectorTest`
covers unequal cadences and latency, equal-quality freshness ties, sustained better-camera handoffs,
dropout and downstream rejection, frozen publications, fluctuating quality, and strict single-tag
freshness. Ongoing stationary collection does not latch on an unselected ready camera or confuse
slow measured yaw with inconsistent solves. Native SOTM regressions reproduce competing resets,
verify large-position recovery alongside heading disagreement, and exercise camera loss, return,
and a previously selected camera becoming unstable.

These checks provide desktop correctness and structural performance evidence. RoboRIO loop timing, CAN traffic, CPU use and radio disconnect behavior require measurement on the robot; they are not established by desktop builds.

Position fusion tracks accepted timestamps per camera, so a fresh slower pipeline is not permanently excluded by a faster fallback. The replay retains original capture times and weights, while rejecting repeated/out-of-order frames from the same camera and all pre-reset captures.

The vision cleanup adds qualification tests for small stationary single-tag corrections, invalidation
after motion/stale/inconsistent frames, and preventing multi-tag evidence from authorizing single-tag
fusion. Passive camera stability remains available when automatic initialization is disabled, and
stationary classification and correction limits use one configuration. Native SOTM regressions check
three-degree single-tag convergence without hard resets or position interruption, stronger-camera
handoff with initialization disabled, and separate disabled/enabled recovery evidence using actual
pose/reset outcomes. The robot's `tests/competition-checks.init.gradle` exposes `verifyRobot` to run
every regression without changing the ordinary deploy workflow.

The native Test-mode transition regression starts with established heading and verifies continued
position fusion without heading corrections or hard resets. It also verifies that turning pose
updates off blocks both corrections and that position updates resume when the switch is restored.

Native stationary-outlier regressions check every frame during an inconsistent camera's rejection,
backup-camera fallback, and stable requalification in disabled and enabled modes. The flagged camera
cannot alter heading through ordinary weighted fusion while its stability window is incomplete.

## Source configuration migration

`generator-checks.ps1` is the compatibility entry point for the Java editor checks. It verifies all four mechanism types, single-field edits, optional values, annotations, structural changes, custom state guards, Java-added states, confirmed removal and reference conflicts. Transaction checks inject a failed write, recover an interrupted save and preserve later external edits. Migration checks compare unapplied JSON with Java, require explicit selections/deletion confirmation, preserve source backups and reject malformed or stale reviews. Old generator switches must refuse to replay JSON.

`dashboard-update-check.ps1` verifies fresh install and repeated update preserve the project-owned dashboard and leave legacy documents untouched for review. `tuning-session-check.mjs` tests app-local recovery across module restart, concurrent merging, project/profile/endpoint isolation and corrupt-file protection. `tuning-recovery-electron-check.cjs` additionally reloads a real renderer and verifies pending drafts, explicit Apply, failed-publication exclusion and profile isolation. Recovery never publishes automatically.

`installed-source-electron-check.cjs <robot-project>` opens the installed production app with robot connections blocked and isolated preferences. It verifies source discovery, the Build Robot menu and no-op Config saves against a byte snapshot of every Java file. Use it on a migrated project; it rejects active legacy configuration files.
