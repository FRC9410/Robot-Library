---
title: Pull Logs from the Robot
date: 2026-10-30
tags: [idea, log-viewer]
status: proposed
---

# Pull Logs from the Robot

**Status:** Proposed, 2026-10-30.

## Idea
One button in Power Tool copies the newest logs off the roboRIO (over SFTP) and opens them.

## Why
Nobody needs Phoenix Tuner or a USB stick to get logs in the pits.

## Open questions
- Where do logs land on our roboRIO? CTRE's docs don't name a default folder. See [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md).
- Should the templates call `SignalLogger.setPath()` so the location is predictable?

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md)
