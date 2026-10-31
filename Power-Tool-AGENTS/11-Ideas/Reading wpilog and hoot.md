---
title: Reading wpilog and hoot
date: 2026-10-30
tags: [idea, log-viewer]
status: decided
---

# Reading wpilog and hoot

**Status:** Decided, 2026-10-30.

## Idea
The viewer opens both `.wpilog` and `.hoot` files. Which one the robot writes (SignalLogger
`.hoot`, WPILib `DataLogManager` `.wpilog`, or both) is decided later, in robot code.

- **One parser:** a TypeScript `.wpilog` reader in the renderer. All widgets read through it.
- **`.hoot` is a conversion step:** the Electron main process runs CTRE's Owlet CLI
  (`owlet -f wpilog in.hoot out.wpilog`) into a temp file, then hands the result to the
  `.wpilog` reader.
- If Owlet isn't found, `.wpilog` files still open, and the viewer explains how to get Owlet.

## Why
- `.wpilog` is a documented format we can parse ourselves.
- `.hoot` is CTRE's own format and can only be read through Owlet.
- Supporting both costs only the Owlet step, and keeps the robot-side choice open.

## Open questions
- Can Owlet ship inside Power Tool, or does each laptop download it? CTRE's CLI tools page doesn't state redistribution terms or how Owlet versions match `.hoot` versions.
- A session makes one `.hoot` per CAN bus. Should the viewer open a whole session folder and merge the files?
- Export licensing: custom signals (PowerLib's) always export. Device signals export in full only with a Pro-licensed device in the log. See [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md).

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
