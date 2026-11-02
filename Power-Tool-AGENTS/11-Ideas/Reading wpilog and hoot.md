---
title: Reading wpilog and hoot
date: 2026-10-31
tags: [idea, log-viewer]
status: decided
---

# Reading wpilog and hoot

**Status:** Decided. Built in v1 (2026-10-31). Tested on real 2026 competition `.hoot` logs (format version 19) using AdvantageScope's cached Owlet.

## Idea
The viewer opens both `.wpilog` and `.hoot` files. Which one the robot writes (SignalLogger
`.hoot`, WPILib `DataLogManager` `.wpilog`, or both) is decided later, in robot code.

- **One parser:** a TypeScript `.wpilog` reader in the renderer. All widgets read through it.
- **`.hoot` is a conversion step:** the Electron main process runs CTRE's Owlet CLI
  (`owlet in.hoot out.wpilog -f wpilog`) into a temp file, then hands the result to the
  `.wpilog` reader.
- If Owlet isn't found, `.wpilog` files still open, and the viewer explains how to get Owlet.

## Why
- `.wpilog` is a documented format we can parse ourselves.
- `.hoot` is CTRE's own, undocumented format, and its layout changes between Phoenix releases. Writing our own reader would break each season, so we use CTRE's Owlet.
- Supporting both costs only the Owlet step, and keeps the robot-side choice open.

## What we learned (2026-10-31)
- **Each Owlet reads one `.hoot` format version ("compliancy").** `owlet <hoot> --compliancy` prints both numbers, and Power Tool picks the matching Owlet.
- **AdvantageScope already caches Owlets** in `%APPDATA%/AdvantageScope/owlet`, named `owlet-<ver>-C<N>.exe`. This laptop had versions 6–21. Power Tool looks there, so nothing extra needs installing.
- **Owlet keeps custom signal names as written** and puts units in the metadata as `{"units": "..."}`. It also adds `RobotEnable`, `RobotMode`, `Voltage`, `CAN Utilization`, `CAN Error Count`, `DS:IsDSAttached`, `DS:IsFMSAttached` and `AllianceStation`.
- **The `rio_*.hoot` file holds the custom signals** and the roboRIO status. The long-ID file is the CANivore's devices.
- A 4 MB match converts in about 0.4 s and parses in about 60 ms.

## Open questions
- Can Owlet ship inside Power Tool for laptops that never ran AdvantageScope? CTRE's CLI tools page doesn't state redistribution terms.
- [x] A session makes one `.hoot` per CAN bus: opening one now opens them all, merged on one clock (2026-11-02). Only the needed signals are exported, since a full CANivore export is ~1 GB.
- Export licensing: custom signals (PowerLib's) always export. Device signals export in full only with a Pro-licensed device in the log. See [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md).

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
