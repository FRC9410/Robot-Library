---
title: Setpoint Error Widget
date: 2026-10-31
tags: [idea, log-viewer, tuning]
status: decided
---

# Setpoint Error Widget

**Status:** Decided. Built in v1 (2026-10-31). Settled means 0.5 s inside tolerance (5% of setpoint or 2% of range); it shows "settling…" while inside but not yet held.

## Idea
For a velocity or position subsystem, a widget that graphs setpoint error. For each setpoint
change it also shows overshoot, time to settle and steady-state error.

## Why
Turns "does this look tuned?" into numbers you can compare between changes.

Related: [Log Viewer Project](Log%20Viewer%20Project.md), [Tuning](../03-PowerLib/Tuning.md), [Standardize Setpoint Keys](Standardize%20Setpoint%20Keys.md)
