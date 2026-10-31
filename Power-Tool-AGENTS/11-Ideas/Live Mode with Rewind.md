---
title: Live Mode with Rewind
date: 2026-10-30
tags: [idea, log-viewer]
status: proposed
---

# Live Mode with Rewind

**Status:** Proposed, 2026-10-30.

## Idea
While connected, record the `/PowerLib/Data` frames (10 Hz) into a ring buffer. The same widgets
then show live data, and you can scrub back, e.g. 30 seconds, to see what just happened.

## Why
- Works today with no robot changes.
- Useful at practice, without pulling a log file.

## Notes
- Could be fed from `TopicSnapshotBuffer` / `nt4Client`. See [NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md).
- The NT frame has no units and runs at 10 Hz, not the log's 50 Hz.

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md), [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md)
