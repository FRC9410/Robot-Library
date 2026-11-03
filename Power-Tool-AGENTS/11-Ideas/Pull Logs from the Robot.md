---
title: Pull Logs from the Robot
date: 2026-10-30
tags: [idea, log-viewer]
status: decided
---

# Pull Logs from the Robot

**Status:** Decided; first version built 2026-11-03, **not yet tried on a robot** (see [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md)). It lives in a popup from the Get logs from robot button (start page and logs list), not in an "On robot" section of the drawer. Not yet: deleting from the robot, free space, blocking while enabled, `session.json` names.

## Idea
One button in Power Tool copies the newest logs off the robot (over SFTP) and opens them.

## Why
Nobody needs Phoenix Tuner or a USB stick to get logs in the pits.

## Ways to get logs into Power Tool

| # | Way | How it works | Good | Catch |
|---|---|---|---|---|
| 1 | **Copy by hand** (works today) | Pull the robot's USB stick or copy with WinSCP, then **Open log** or drag the files in | Nothing to build | Slow; easy to grab the wrong match |
| 2 | **Download from the robot** | Power Tool connects over SSH/SFTP (`roborio-9410-frc.local` / `10.94.10.2`), lists the log files, you click a match to download and open it | One click in the pits, no USB stick. AdvantageScope has the same feature | Needs to know where logs are; Systemcore (2027) will likely change paths |
| 3 | **Record while connected** | Power Tool, already on NetworkTables for the dashboards, saves what it sees to a `.wpilog` as it goes | Nothing to copy; works on Systemcore; could run on the driver station laptop during matches | Only what PowerLib publishes on NT (10 Hz frames), not the 100 Hz motor data in the `.hoot`; a dropped connection leaves gaps |
| 4 | **Spot the USB stick** | When a stick with a `logs` folder is plugged in, offer to open the newest match | Simple, offline | Still means pulling the stick from the robot |
| 5 | **Driver Station logs** | Read the DS's `.dslog` / `.dsevents`, already on the driver station laptop | No transfer; named by match; brownouts, voltage, CAN, packet loss | Robot health only (no subsystems or pose); goes alongside a robot log |
| 6 | **Phoenix Tuner X** | CTRE's tool downloads the `.hoot` files, then open them | Already exists | Another app; what #2 replaces |

## Plan
1. **Build #2 first.** Before that, make the log location predictable: the PowerLib template calls `SignalLogger.setPath(...)`. Keep the robot folder path a Power Tool setting so Systemcore can be handled later.
2. **Then #3 as a backup** for when the `.hoot` never got written or the download fails. It also sets up [Live Mode with Rewind](Live%20Mode%20with%20Rewind.md).
3. **#5 as a cheap bonus:** brownout and packet-loss flags straight from the DS, matched to each match (the Logs tab's [Problem Markers](Problem%20Markers.md) are hidden for now).

## Decided (2026-11-03)
- **Where it lives:** a **Get logs from robot** button on the Logs tab's start page, next to **Open log**.
- **When it works:** the button is enabled when the roboRIO answers on SSH (port 22), not when NetworkTables is connected, because the logs that matter most are often from times the robot code crashed. Power Tool checks every few seconds while the start page is open.
- **When the robot is off:** the button is **greyed out**, with no message.
- **What a click does:** a dialog lists the sessions on the robot, newest first, with time and size. Picking one downloads it and opens it in the Logs tab, like **Open log**.
- **Dialog sketch:** header with a refresh button and a status line (green dot, `roboRIO 10.94.10.2`, session count). Rows newest first, each with a checkbox, a name (see below), and a status: "On robot", "Downloaded" (already in the [Built-in Log List](Built-in%20Log%20List.md) folder), or a progress bar while copying. Footer: how many are selected, **Cancel**, and the download button. Same low-clutter rules as the Built-in Log List: no file size, and a warning only when a file is missing ("No CANivore log").
- **One vs. many:** one ticked → **Download and open**. Several ticked → **Download N**: they all go to the logs folder and nothing opens, since the Logs tab shows one session at a time. None ticked → greyed out.
- **Names:** PowerLib writes a small `session.json` into each log folder on the robot with the event name, match type and number, alliance station (from `DriverStation`) and enabled time. Power Tool reads it without converting the `.hoot`. Rows then read "Match · Qual 14 · NYRO", "Practice · 3:10 PM", or "Not enabled · 1:55 PM" (greyed out). Practice sessions can be renamed ("Shooter tuning, new wheels"); the name is saved on the laptop. Logs without `session.json` fall back to the start time.
- **Timing:** a later version; this is brainstorming for now.
- **Code layout:** `OpenLogPrompt` takes its buttons as `children` (no `robotConnected` flag). New files: `RobotLogsButton`, `RobotLogsDialog`, and `robotLogsModel.ts` (folder listing → session rows). SFTP runs in Electron's main process behind `window.powerlib`.

## 2027 notes (from CTRE's changelog, 2026-11-03)
Full checklist: [2027 and Systemcore Readiness](2027%20and%20Systemcore%20Readiness.md).
- **Checked 2026-11-03:** Systemcore's SFTP is `robot.local`, user `systemcore`, password `systemcore`, port 22 (WPILib docs). AdvantageScope already downloads Systemcore logs this way.
- **Unchecked:** logs go to `/U/logs` on a USB stick, else `/home/systemcore/logs`, and the first run after a cold boot can land on internal storage. List both folders.
- The 2027 Driver Station writes `.wpilog` files (`FIRST_DS` in the name, `Public Documents\FIRSTDriverStation\Logs`), so plan step 3 (#5, DS logs) needs no new parser.
- The 2027 Phoenix releases so far are alphas that run only on the **Systemcore**, not the roboRIO. Wait for the stable 2027 release (likely kickoff) before building anything roboRIO-specific.
- In the 2027 alpha, **all CAN buses go into a single `.hoot`** instead of one per bus. Power Tool's sibling-file lookup (`sessionSiblings`) and bus naming by file name will need updating then. See [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md).
- Converting those logs needs owlet 26.70.0 or newer; current stable logs (Phoenix 26.3.0) use the C19 Owlet.

## Open questions
- Where do logs land on our roboRIO? CTRE's docs don't name a default folder. See [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md).
- Should the templates call `SignalLogger.setPath()` so the location is predictable? (The plan above says yes.)
- 2026-Robot-Powerlib-Rewrite never calls `SignalLogger.start()` for matches; check that match `.hoot` files get written before relying on #2.

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md), [Live Mode with Rewind](Live%20Mode%20with%20Rewind.md), [Problem Markers](Problem%20Markers.md)
