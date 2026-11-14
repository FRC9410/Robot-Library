# Subsystem characterization

[Project README](../README.md) · [All guides](README.md) · [Log Viewer](log-viewer.md)

Open **Logs → Characterize Robot**. Choose a category in **Subsystem types**, select the mechanisms to test, confirm the robot and area are ready, then click **Start characterization**. All selections start unchecked.

Choose **All velocity subsystems** to test velocity and velocity-torque mechanisms together, or choose a single type to filter the list. Choose **Drivetrain** for manual drive tests and automatic steering tests.

## Drivetrain characterization

Select drive, steering, or both, and review each target’s limits. Drive moves the robot. Clear its path in both directions and stay clear of the steering modules. Start disabled in Test mode on FRC Driver Station. In Sim without DS, use the Robot State controls in the WPILib Simulation GUI. [CTRE SysId safety and test guidance](https://v6.docs.ctr-electronics.com/en/stable/docs/api-reference/wpilib-integration/sysid-integration/plumbing-and-running-sysid.html#before-characterization) · [WPILib Simulation GUI](https://docs.wpilib.org/en/stable/docs/software/wpilib-tools/robot-simulation/simulation-gui.html)

1. For drive, click **Start walkthrough**. Reposition the disabled robot as needed, then click **Arm test** for each of the four drive profiles. Wait for **Test armed** before enabling in Test mode. The arm expires after 30 seconds.
2. When each drive test finishes, disable the robot. Power Tool waits for Disabled and the test command to release, collects the log, and offers the next drive test.
3. Steering runs automatically. Select steering alone to start it with **Start characterization**, or select both to run it after all four drive tests finish and the robot is disabled. Power Tool enables and disables between steering profiles.
4. Disable early or click **Stop characterization** to cancel the sequence. During drive, Stop neutralizes characterization output and prompts the operator to disable. During steering, it also requests disable.

Each completed test is saved with the run report. Rebuild the robot with current PowerLib before using the walkthrough.

## Arms and elevators

Choose **Arms & elevators** in **Subsystem types** to check a position mechanism before characterization. Select the mechanism and confirm the test window in mechanism rotations. Power Tool prefills configured relative-position soft limits when available. Watch the live encoder reading and use **Use current position** to fill **Min** or **Max**. Set an inner **Lower stop** and **Upper stop** with room to stop after motor output is removed. Gravity-loaded mechanisms may need mechanical support.

Click **Arm Crawl** with the robot disabled, then enable manually in Test mode. In Sim without DS, use the WPILib Simulation GUI. **Nudge** applies a short, low-voltage pulse with an initial speed cutoff of **0.010 rotations/s**. The cutoff changes in **0.005 rotations/s** increments, and the pulse voltage remains capped. **Speed Up**, **Speed Down**, and **Flip Direction** change the next nudge. Flip Direction changes the sign of the pulse and leaves motor and encoder configuration intact.

The robot cuts output at the speed cutoff, the stop in the travel direction, or the pulse timeout. Disable the robot to finish the crawl.

Switch to **SysId** in the same setup. Select the gravity model, confirm which way positive voltage moves the mechanism, and enter the encoder position at horizontal for an arm. Use a speed cutoff that leaves enough room to stop. Review the ramp, voltage ceilings and duration for the test window.

Click **Start SysId walkthrough**, then arm, enable and disable manually for each of the four phases. Start each phase stationary within the outer bounds and before its directional stop. With a window of 0.0 to 0.5 rotations and inner stops at 0.1 and 0.4, start forward at 0.0 or reverse at 0.5. The robot ends a phase early at the speed cutoff or the stop in its travel direction. Power Tool collects the completed logs and fits **kS**, **kV**, **kA**, and **kG**. The report includes the test window and directional stops and flags inadequate motion. **Run again** restores the selected mechanism and its fields. Use **Close** to clear the dialog drafts. [WPILib arm and elevator models](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/system-identification/introduction.html#elevator-identification)

## Before starting

Connect Power Tool to a robot or simulation rebuilt with the current PowerLib files and generated characterization registrations. Saving a subsystem configuration refreshes those registrations.

On a physical robot or in **Sim with DS**, open the normal **FRC Driver Station on the same Windows computer**, choose **Test**, and start **Disabled**. Verify travel in both directions and review the ramp ceiling, step voltage, and duration for each selected mechanism before confirming readiness.

Power Tool brings Driver Station to the foreground and uses its documented enable and disable keyboard shortcuts. Driver Station must be running at the same privilege level as Power Tool and able to receive focus. It must remain in Test mode. FMS attachment or an E-stop prevents the sequence. Power Tool does not replace Driver Station or send hardware enable through NetworkTables.

Power Tool checks Driver Station focus and permissions before preparing the first test. On Windows, open **Logs → Characterize Robot** and choose **Restart as administrator** when prompted. Accept Windows UAC to return directly to characterization. A privilege mismatch or blocked focus stops the workflow with a readable message before any enable shortcut is sent. Keep Driver Station's main window available and close any popup.

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

Each velocity test defaults to **5 seconds**, with a **1 V/s** ramp, **4 V** ramp ceiling, and **4 V** dynamic step. The test settings apply to all selected targets in the run. A separate ramp ceiling requires current robot code.

The robot is disabled between **every test**, including between directions. Increase the disabled gap if the mechanism is still moving before the next test. State handlers and registered subsystem commands are suspended during each test, and tuning is turned off. CTRE calls for roughly 3–5 seconds of quasistatic data and advises setting the limits according to available travel. [CTRE SysId procedure](https://v6.docs.ctr-electronics.com/en/stable/docs/api-reference/wpilib-integration/sysid-integration/plumbing-and-running-sysid.html#running-characterization)

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
| Velocity | V | V / (rotations/s) | V / (rotations/s²) |
| Velocity-torque | A | A / (rotations/s) | A / (rotations/s²) |

Rotations are the configured motor feedback's mechanism rotations. Verify feedback ratios before transferring gains to another configuration. Velocity-torque tests command voltage and fit the **measured torque current**. The JSON also retains a secondary voltage fit when available. For hardware validation, check the amp-based gains at low and high operating speeds in `TorqueCurrentFOC`. [CTRE torque-current tuning](https://v6.docs.ctr-electronics.com/en/stable/docs/api-reference/device-specific/talonfx/manual-pid-tuning.html#flywheel-tuning-with-torquecurrentfoc)

The report shows the effective settings for each subsystem. **Show test data** lists recorded time, usable motion time, sample count, and peak speed for each phase. A quasistatic phase with under 3 seconds of usable motion gets a warning. The fit requires at least 10 usable motion samples per phase and still reports low fit quality or nonphysical gains. The operator applies gains after review.

## Hardware reference comparison

1. Record the hardware run with Phoenix SignalLogger active. On hardware, PowerLib adds `PowerToolCharacterization/TestId`, `PowerToolCharacterization/Target`, and `PowerToolCharacterization/State` markers to an active logger.
2. Convert the Phoenix `.hoot` to WPILOG with Tuner X or Owlet. Use the test IDs in the saved report to match the four phases and select the Talon FX position, velocity, and motor-voltage signals in WPILib SysId.
3. Compare the voltage gains and motion traces for the same target, direction, and configured feedback units. For velocity-torque, compare the secondary voltage fit and validate the current-based gains separately with the torque-current controller.

[CTRE SignalLogger](https://v6.docs.ctr-electronics.com/en/stable/docs/api-reference/api-usage/signal-logging.html) · [CTRE SysId log export](https://v6.docs.ctr-electronics.com/en/stable/docs/api-reference/wpilib-integration/sysid-integration/plumbing-and-running-sysid.html#running-characterization)

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
