---
title: Problem Markers
date: 2026-10-30
tags: [idea, log-viewer]
status: proposed
---

# Problem Markers

**Status:** Proposed, 2026-10-30.

## Idea
Flag likely problems on the timeline so you can jump to them:
- brownouts (`PowerLib/RobotStatus/BrownedOut`);
- CAN usage spikes (`Drive/RioCanUtilization`);
- a mechanism far from its setpoint for more than about half a second;
- vision rejecting many frames (`Vision/*/Status`);
- `Robot/Control/Action` events.

## Why
Finding where something went wrong is usually the slowest part of reviewing a log.

## Open questions
- Which thresholds, and should they be adjustable per robot?

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
