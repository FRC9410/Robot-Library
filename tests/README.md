# Library validation and review

Run these checks from the Robot-Library root in PowerShell 7. They write fixtures and logs under ignored `build/` directories. Java checks need the installed WPILib 2026 JDK/Maven files and cached Phoenix/vendor dependencies. Dashboard checks need its npm dependencies installed.

```powershell
./tests/run-library-checks.ps1
./tests/state-machine-check.ps1
./tests/generator-checks.ps1
./tests/generated-robot-check.ps1
Push-Location powerlib-dashboard
try {
    node scripts/telemetry-buffer-check.mjs --java-fixture
    node scripts/drive-model-check.mjs
    node scripts/subscription-check.mjs
    node scripts/tuning-check.mjs
    npm run build
} finally { Pop-Location }
```

The generated-robot check runs the actual installer in an isolated fixture, compiles the full robot template with real WPILib/vendor jars, runs the actual generator using Windows PowerShell 5.1, verifies unchanged Java sources on a second update, and compiles all four generated mechanism types. Supply `-GradleExecutable` if Gradle 8.11 is outside the normal WPILib cache. This validates Java compilation, not deployment to a roboRIO.

The state-machine check runs the template state logic and real WPILib instant command
with hardware stubs and one test-only enum value. It checks first-match priority,
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

The follow-up quality review adds these checks without changing the vision flush or JSON generation workflow:

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
- Relative `slowThreshold` remains in the constructor and JSON format for compatibility; its accessor is deprecated. Decreasing/equal position requests select the slow profile, and increasing requests select the normal profile. No new threshold behavior was added.
- Actual state must be updated by the robot's state controller when a transition happens; it is not inferred from requested state.
- State requests are stored per owner and arbitrated by handler registration order. The state-machine fixture covers independent requests, priority changes, guarded transitions, and skipping selection for an unchanged single request. ButtonBindingsTest verifies one action per press/release edge and stable, distinct owners for state bindings.
- AutoTest checks equivalent direct-point and path-cursor sequences, drive completion before subsequent commands, copied destinations, mixed styles, fresh command instances, subsystem requirements, interrupted drive cleanup and invalid definitions. AutoBuilderTest checks chooser registration snapshots, repeated runs, alliance filtering, defaults and existing factory registration. The fresh-install check also verifies the Auto definition class and RobotAutos starter are installed and wired, and reinstalling preserves custom robot autos without a template copy.
- HealthChecksTest covers freshness boundaries, invalid timestamps/poses, and missing feedback. ConfigurationValidationTest verifies that simulation health checks still reject failed startup configuration.
- Mechanism simulation is a deterministic control/readiness model with acceleration and soft limits. It is not a calibrated model of mechanism inertia or loads. Swerve/MapleSim integration remains separate.

These checks provide desktop correctness and structural performance evidence. RoboRIO loop timing, CAN traffic, CPU use and radio disconnect behavior require measurement on the robot; they are not established by desktop builds.
