---
title: 2027 and Systemcore Readiness
date: 2026-11-03
tags: [idea, log-viewer, powerlib, systemcore, 2027]
status: proposed
---

# 2027 and Systemcore Readiness

**Status:** Proposed, 2026-11-03. A checklist of what has to change so PowerLib and Power Tool
work next season, when Systemcore replaces the roboRIO.

## Idea
Find every place that assumes the 2026 game or the roboRIO, and fix them before the 2027 season.
Power Tool should work out what a log contains instead of assuming a year, so it opens 2026 and
2027 logs side by side.

## Why
The team will still open this season's logs next year, and Systemcore, WPILib 2027 and Phoenix
2027 all land at once.

## Already works in 2027
- **`.wpilog` reader:** WPILib's format; not changing.
- **Widgets:** chosen from PowerLib key names and data shapes, not this season's mechanisms. See the [Project Overview](INDEX.md).
- **Field size:** from the template's `field` settings (`LogsPanel.tsx`), not code. A new game means new numbers.
- **Owlet choice:** Power Tool picks the Owlet matching the log's format version (`electron/owlet.ts`). Open one 2027 `.hoot` in AdvantageScope once and the new Owlet (26.70.0 or newer) is cached where Power Tool looks.

## Needs work
1. **PowerLib on WPILib 2027 and Phoenix 2027.** The biggest job; the rest depends on it. Phoenix 2027 runs only on Systemcore and is in alpha. Port for real once the stable release is out (likely around kickoff); trying the betas before then is fine.
2. **One `.hoot` per session.** In the 2027 alpha all CAN buses go into a single file instead of `rio_*` plus one per CANivore. These assume `rio_` file names:
   - `sessionSiblings` in `electron/owlet.ts` (finds a session's other files);
   - the bus label in `logModel.ts` (`rio` / `CANivore` from the file name);
   - the file sort in `useLogFile.ts`.

   They need to accept a single file and take bus names from inside the log.
3. **Connection targets.** `ConnectionSettingsDialog.tsx` has `10.94.10.2` and `roborio-9410-frc.local` written in. Add `robot.local` (Systemcore's mDNS name; the IP stays `10.94.10.2`) and change "roboRIO" labels to "Robot".
4. **Owlet's own signal names.** `logModel.ts` (`owletSignals`) falls back on `RobotMode`, `RobotEnable`, `Voltage`, `CAN Utilization` and `DS:IsFMSAttached` when PowerLib keys are missing. If CTRE renames them, those fallbacks stop working without an error. PowerLib's own keys aren't affected.
5. **Getting logs off the robot.** Systemcore has a different login (`systemcore` / `systemcore` at `robot.local`) and log folders (see Research below). Keep the robot folder a setting, as Get logs from robot already does, and don't build this part until we can look at a real Systemcore.

## What other teams found
From Team 604's alpha-testing thread on Chief Delphi ("Team 604 Quixilver Systemcore Alpha Testing", updates Aug 2025 to Jul 2026). They use AdvantageKit, so none of this is about `.hoot` or SignalLogger specifically.
- **Internal storage is small.** The eMMC is 16 GB but the main partition is only 4 GB. Their logs filled it halfway through playoffs, and nobody noticed until they got home (the robot kept running).
- **USB logging has been unreliable.** At Chezy Champs (Nov 2025) logs meant for the stick (they expected `/U/logs`) went to internal storage instead, so they deleted internal logs after every match and ended up with no match logs. Alpha 7 didn't fully fix it, and as of Jul 2026 logs don't save to USB on first boot (Systemcore issue #341).
- **They still use a CANivore.** As of Jul 2026 they didn't use Systemcore's built-in CAN buses, because full CTRE CAN FD support wasn't there yet. So the CANivore may stay for 2027.
- **NetworkTables clients don't always connect on boot** (issue #345). Power Tool's live tabs may need a reconnect, and the Get logs from robot button should keep checking SSH, not NetworkTables (already the plan).
- Heavy logging raised their loop times.

What this means for us:
- Get logs from robot matters more on Systemcore: pulling logs after each match keeps the 4 GB partition from filling. The download dialog should show free space on the robot, and we should rethink "read-only": offering to delete logs once they're downloaded may be needed.
- Don't rely on a USB stick for 2027 until these issues are fixed.

## Plan
- **Get a real 2027 log early**, from a Systemcore on the beta or from simulation, and add it to `scripts/log-check.mjs` next to the 2026 fixtures so both are checked every run.
- **Check what the file contains, not the year:** "one `.hoot` with several buses" versus "one `.hoot` per bus".

## Research (2026-11-03)
From a Gemini research pass, each claim below checked against its source. "Checked" means the source says it; "unchecked" means Gemini said it but the source didn't, or wasn't opened.

**Checked**
- **Connecting:** SFTP host `robot.local`, user `systemcore`, password `systemcore`, port 22 (WPILib "Systemcore SFTP" doc). AdvantageScope switched its default robot address to `robot.local` (27.0.0-alpha-6) and downloads logs from Systemcore over SFTP (27.0.0-alpha-1) (`wpilibsuite/SystemCoreTesting` `AdvantageScope.md`).
- **One `.hoot` for all buses:** Phoenix 26.70.0-alpha-2 (2026-09-18): "All CAN buses are now logged to a single hoot log. This requires owlet 26.70.0 or newer." Tuner X 2026.10.0.0 (2026-09-28) ships Owlet 26.70.0 (CTRE changelog).
- **Match names in `.hoot` file names:** the same release fixed Systemcore not renaming hoot logs with the FMS match name, and added the missing `EStopped` and `AllianceStation` fields. No signal renames are listed, but it says the Driver Station data format "will be adjusted".
- **SignalLogger auto-start:** starts when the robot is enabled, or 5 s after program start with the DS connected (leaving time for `setPath`); never stops or restarts on its own (`CTR-Phoenix.md`).
- **CAN:** Systemcore's ports are used with `new CANBus(CANPort.CAN_S2)`; a CANivore still works through the `canivore-usb` package (`CTR-Phoenix.md`).
- **WPILib 2027** (2027 yearly changelog): Java 25; packages move from `edu.wpi.first` to `org.wpilib`; integer timestamps are now nanoseconds, but `.wpilog` and NetworkTables still use microseconds; the "Test" mode is renamed **"Utility"**; the `FMSInfo` table is renamed `DriverStation`; low free space raises an alert, the log moves to USB when one appears, and cleanup no longer deletes match logs.
- **Epoch timestamps:** Systemcore logs use Unix epoch timestamps by default (`AdvantageScope.md` known issue). Power Tool already measures time from the first sample, so this shouldn't break the timeline, but check it on a real log.
- **2027 Driver Station logs are `.wpilog`:** named with `FIRST_DS`, saved in `Public Documents\FIRSTDriverStation\Logs` on Windows (`~/.firstds` on Linux); its web page is `http://localhost:6768` (WPILib "Driver Station Log File Viewer"). No more `.dslog` / `.dsevents`, so Power Tool's existing reader can open them.

**Unchecked** (confirm on a real Systemcore)
- Log folders: `/U/logs` on a USB stick, else `/home/systemcore/logs`, and the first run after a cold boot landing on internal storage (Systemcore issue #341). Team 604 also mentions `/U/logs`.
- Bus names inside the single `.hoot` (`can_s0`–`can_s4`), and what the single file is named.
- Whether Owlet's `RobotMode`, `RobotEnable`, `Voltage`, `CAN Utilization` and `DS:IsFMSAttached` keep their names.
- USB sticks formatted GPT mounting the wrong partition (issue #424); use MBR.

## What this adds to "Needs work"
- **"Test" → "Utility":** `DriveTelemetry.java` writes `TEST`; `driveModel.ts`, `logUtils.ts` (`periodColors`) and `drive-model-check.mjs` read it; `Swerve.java` and `Vision.java` call `DriverStation.isTest()`. Accept both names in Power Tool so 2026 and 2027 logs both work.
- **`Timer.getFPGATimestamp()`** in `SubsystemTelemetry.java`, `TuningCadence.java`, `PowerDashboard.java`, `Swerve.java` and `Vision.java`: check what it's called and returns in 2027 (the FPGA clock became the "monotonic" clock). The double-seconds API may be fine; raw integer timestamps changed to nanoseconds.
- **Get logs from robot:** connect to `robot.local` as `systemcore`, and list both `/U/logs` and `/home/systemcore/logs`.
- **Driver Station logs:** reading them is now cheap, since they're `.wpilog`. Add `FIRSTDriverStation\Logs` as a second folder, or match them to robot logs by time.

Related: [Project Overview](INDEX.md), [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
