---
title: Log Viewer Project
date: 2026-10-31
tags: [project, log-viewer, power-tool]
---

# Log Viewer Project

The hub for the Power Tool log viewer (the **Logs** tab). Branch: `feature/Log-Viewer`. Each idea
we talk about gets its own note in this folder (listed in [Ideas](INDEX.md)). This note keeps the
status and the project-wide open questions. Code changes go in the
[CHANGELOG](../09-Changelog/CHANGELOG.md). How the built code works is in
[Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md#logs-featureslogs).

## Status
- 2026-10-30: Planning and ideas.
- 2026-10-31: **v1 built.** Logs tab with a fixed layout and the mechanism picker. Opens `.wpilog` directly and `.hoot` through Owlet. Shows the match list, problem markers, setpoint error stats, field with trail and state strip, with playback. To be tuned as we use it.

## Built in v1
- [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md)
- [Mechanism Picker](Mechanism%20Picker.md) (the default and only layout for now)
- [Choosing Widgets by Data Shape](Choosing%20Widgets%20by%20Data%20Shape.md): the PowerLib-conventions part. Type-based widgets for arbitrary signals aren't built.
- [Widget Grid and Shared Timeline](Widget%20Grid%20and%20Shared%20Timeline.md): the shared timeline. Drag-and-drop isn't built.
- [Match List](Match%20List.md)
- [Problem Markers](Problem%20Markers.md): brownout, CAN and setpoint misses. Vision and action events aren't built.
- [Setpoint Error Widget](Setpoint%20Error%20Widget.md)

Other ideas are listed in [Ideas](INDEX.md).

- 2026-10-31: Tested on real 2026 competition logs (pre-PowerLib). Power Tool now finds AdvantageScope's cached Owlets and picks the one matching the log's format version. It also reads Owlet's built-in signals and plain `<Name> Velocity` names. See [Reading wpilog and hoot](Reading%20wpilog%20and%20hoot.md).

- 2026-10-31: Opening a real `.hoot` from the Open log dialog works end to end in the Electron app.

## Not tested yet
- A log from a PowerLib robot. The real logs so far predate PowerLib; PowerLib keys are only tested with the synthetic match.

## Open questions (project-wide)
Questions about a single idea live in that idea's note.
- [x] Do real Owlet exports keep custom signal names and put units in the metadata? Yes, `{"units": "..."}`.
- [ ] Should the templates call `SignalLogger.setPath()`/`start()` so logs land somewhere predictable?
- [ ] Should the robot also write a WPILib `DataLogManager` `.wpilog` so no conversion is needed? (The viewer already reads its `/PowerLib/Data` frames.)
- [ ] Large logs: parsing runs on the renderer thread. Move it to a worker if real logs make the UI hang.
- [ ] Verify the Phoenix default log location and auto-start behavior on our roboRIO. CTRE's docs say it auto-starts when enabled on a roboRIO 2 (see [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)).

Related: [Ideas](INDEX.md), [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md), [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
