---
title: Telemetry Flow
date: 2026-10-30
tags: [data-flow, telemetry, logging, log-viewer]
---

# Telemetry Flow

One shared map feeds two outputs: a **50 Hz log** on the robot and a **10 Hz NT frame** for Power Tool.

```mermaid
flowchart LR
  subgraph Robot["Robot (20 ms loop)"]
    S[Mechanisms<br/>setSubsystemData] --> M[(Shared data map<br/>PowerRobotContainer)]
    D[DriveTelemetry<br/>Drive/*] --> M
    M --> ST[SubsystemTelemetry.publish]
    RL[RobotLogTelemetry] --> SL
    VI[Vision.java status keys] --> SL
    ST -->|every loop, 50 Hz| SL[[SignalLogger → .hoot on roboRIO]]
    ST -->|every 100 ms| F["/PowerLib/Data<br/>JSON frame"]
    ST -->|every 100 ms| P["/PowerLib/Subsystems/Drive/Data/Pose<br/>Pose2d struct"]
  end
  F --> NTC[Power Tool nt4Client]
  NTC --> BUF[TopicSnapshotBuffer<br/>decode → /PowerLib/Subsystems/X/Data/key]
  BUF -->|100 ms flush| UI[Drive & Robot tabs]
  P --> AS[AdvantageScope]
  SL -.->|pull from robot, export via Owlet| LV[Log viewer — planned]
```

## What goes where
| Data | SignalLogger (.hoot) | NT `/PowerLib/Data` | Power Tool |
|---|---|---|---|
| Every shared-map metric (all owners) | ✅ 50 Hz, typed, with units | ✅ 10 Hz, no units | ✅ latest value only |
| `Drive/Pose` | ✅ struct (valid only) | ✅ `{xMeters,yMeters,headingRadians}` or null | ✅ field view |
| `PowerLib/RobotStatus/*` (DS/FMS/brownout…) | ✅ | ❌ | ❌ |
| `Vision/*` status, `Robot/Control/Action` | ✅ | ❌ | ❌ |
| Phoenix device signals (auto-logged) | ✅ | ❌ | ❌ |
| Tuning variables, auto chooser, cameras | ❌ | separate NT topics | ✅ |

## Steps
1. Subsystems and `DriveTelemetry` write their latest values into the [Shared Data Store](../03-PowerLib/Shared%20Data%20Store.md).
2. `PowerDashboard.periodic()` calls `SubsystemTelemetry.publish()` every loop:
   - it always logs the map to SignalLogger;
   - every 100 ms it also builds the JSON frame (`sequence` +1) and publishes it.
3. Power Tool subscribes at 100 ms. `DataSnapshot` decodes the frame into synthetic per-field topics. `TopicSnapshotBuffer` **replaces** the previous frame, so removed fields disappear.
4. Panels re-render through `useTopics(view)` on a 100 ms flush.

Details: [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md) (robot side),
[NetworkTables Layer](../05-Power-Tool/NetworkTables%20Layer.md) (dashboard side). Both sides are
checked against the same fixture frame (see [Tests and Checks](../07-Testing/Tests%20and%20Checks.md)).

Related: [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md), [Tuning Round Trip](Tuning%20Round%20Trip.md)
