# Subsystem characterization

[Project README](../README.md) · [All guides](README.md) · [Log Viewer](log-viewer.md)

In **Logs → Characterize Subsystems**, select the mechanisms to test, confirm the robot and area are ready, then click **Start characterization**. All selections start unchecked.

The available selections are configured **velocity** and **velocity-torque** subsystems, plus **Drivetrain**. Drivetrain runs separate drive and steering tests and reports gains for each of the four modules. Position subsystems are excluded.

## Before starting

Connect Power Tool to a robot or simulation rebuilt with the current PowerLib files and generated characterization registrations. Saving a subsystem configuration refreshes those registrations; a freshly extracted project already includes drivetrain support.

On a physical robot or in **Sim with DS**, open the normal **FRC Driver Station on the same Windows computer**, choose **Test**, and start **Disabled**. The mechanism must have enough travel for both directions. Support the drivetrain so the wheels can rotate and steer freely. Check voltage and duration limits for the actual mechanism before confirming readiness.

Power Tool brings Driver Station to the foreground and uses its documented enable and disable keyboard shortcuts. Driver Station must be running at the same privilege level as Power Tool and able to receive focus. It must remain in Test mode. FMS attachment or an E-stop prevents the sequence. Power Tool does not replace Driver Station or send hardware enable through NetworkTables.

Power Tool checks Driver Station focus and permissions before preparing the first test. Open Driver Station first, then double-click the project's **Power Tool.cmd**. If Driver Station is elevated, the launcher requests matching administrator access automatically; accept Windows' UAC prompt. If you need to request elevation before Driver Station opens, run `"Power Tool.cmd" -Administrator`. A privilege mismatch or blocked focus stops the workflow with a readable message before any enable shortcut is sent. Keep Driver Station's main window available and close any popup.

NI's LabVIEW application exposes a wrapper window separately from the visible FRC Driver Station control panel. Power Tool identifies the visible panel and verifies that exact panel and process before delivering a shortcut; help windows and dialogs are excluded.

Shortcuts use keyboard scan codes and hold the chord for 200 ms before releasing every key. Power Tool then waits for the robot to acknowledge Enabled separately from waiting for the test to finish. Windows accepting a keystroke does not count as robot enable acknowledgement.

| Runtime | Enable/disable control | Log collection |
|---|---|---|
| Physical robot | Open FRC Driver Station | Robot SFTP |
| Sim with DS | Open FRC Driver Station | Local simulation logs |
| Sim without DS | Internal WPILib simulation controls | Local simulation logs |

The robot reports which source controls enable/disable, and the modal displays it. **Sim with DS** is detected from WPILib's loaded DS-socket extension; internal simulation-control requests are ignored in that mode. Physical enable always stays with Driver Station. Rebuild and restart an older simulation if Power Tool cannot identify its control mode. Launch only one robot simulation at a time.

## What runs

Each selected target runs these WPILib SysId profiles:

1. Quasistatic forward: a slowly increasing voltage.
2. Quasistatic reverse: the same ramp in reverse.
3. Dynamic forward: a voltage step.
4. Dynamic reverse: the same step in reverse.

Drivetrain runs all four for drive, then all four for steering. The voltage ramp is capped at the selected voltage limit. The robot is disabled between **every test**, including between directions. The disabled gap lets a mechanism slow down before the next test; increase it if the mechanism is still moving. State handlers and registered subsystem commands are suspended during each test, and tuning is turned off.

Use **Stop characterization** to stop the sequence. Disabling during an active test also cancels it; the workflow does not proceed to another enable. E-stop remains available in Driver Station. If Power Tool or its connection disappears, the robot's 1.5-second lease stops characterization output. On hardware, Driver Station still controls the enable state: disable there if the app is unavailable.

## Results and units

Power Tool records measured voltage, position, velocity and torque current to a dedicated WPILOG, closes it, retrieves it, and converts it to CSV for analysis. These logs do not require CTRE Owlet.

Analysis uses the [WPILib SysId simple-motor acceleration regression](https://github.com/wpilibsuite/allwpilib/blob/v2026.2.1/sysid/src/main/native/cpp/analysis/FeedforwardAnalysis.cpp):

```text
acceleration = alpha × velocity + beta × input + gamma × sign(velocity)
kS = -gamma / beta       kV = -alpha / beta       kA = 1 / beta
```

The built-in analysis uses a centered median velocity filter, a three-point derivative, and a fixed whole-test window. It implements the SysId regression directly; it does not launch the SysId GUI or reproduce that GUI's automatic trimming. The JSON records the analysis method and filter settings. Failed or poorly conditioned fits show an error; low fit quality produces a warning.

| Target | kS | kV | kA |
|---|---|---|---|
| Velocity, drive, steering | V | V / (rotations/s) | V / (rotations/s²) |
| Velocity-torque | A | A / (rotations/s) | A / (rotations/s²) |

Rotations are the configured motor feedback's mechanism rotations. Check the feedback ratios before transferring gains to another configuration. Velocity-torque reports also retain a secondary voltage fit in JSON. Results appear in the modal and are **not automatically applied** to robot constants. Simulation results describe the simulation model; use physical measurements for hardware gains.

## Saved files

Every started run gets a new folder in the robot project:

```text
power-tool/characterization/<timestamp>-<run-id>/
  characterization.json
  diagnostics.jsonl
  logs/<test-id>.wpilog
  logs/<test-id>-motor-0.csv
```

The JSON is written when a run starts, after each collected test, and when it finishes. It includes selections, limits, timestamps, samples, gains, units, fit quality and completion/failure/cancellation status. An app crash can leave a `running` report containing the tests already collected. Raw logs and CSVs stay with the report for review; Git ignores those `logs/` directories while keeping JSON reports available to commit.

The report's `diagnostics` timeline also records preparation, enable/disable requests, robot status changes, log collection and cleanup. Each event is appended immediately to `diagnostics.jsonl`, then included in the JSON report at test boundaries and completion. A timeout identifies the subsystem, direction/profile and acknowledgement being awaited, followed by the last reported robot state, enabled/Test flags, DS attachment, command scheduling/start flags, test ID and status age. Robot snapshots include the last simulation-control request and heartbeat age when supported. A failure or app exit before the first log is collected still leaves the journal. Older robot builds show unsupported status fields as `unknown`.

Report replacement retries temporary Windows sharing locks. If the original JSON remains locked, Power Tool saves the run to `characterization-recovery.json` in the same folder and displays its path and a storage warning. The old file and raw artifacts are retained.

Robot-side originals are under `logs/power-tool-characterization/` in simulation, or `/U/logs/power-tool-characterization/` on a robot with USB storage, falling back to `/home/lvuser/logs/power-tool-characterization/`. Hardware collection uses the robot host selected in Power Tool.
