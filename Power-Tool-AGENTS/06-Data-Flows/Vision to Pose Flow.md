---
title: Vision to Pose Flow
date: 2026-10-30
tags: [data-flow, vision]
---

# Vision to Pose Flow

What the template `Vision.periodic()` does each 20 ms loop to correct the `Swerve` pose estimator.

```mermaid
flowchart TD
  A[Pose reset happened?<br/>poseResetVersion changed] -->|yes| A2[reset selector, establish heading]
  A --> B[Gyro health + VisionPoseFilter.observe<br/>pitch/roll level check]
  B --> C[LimelightVision.update<br/>publish orientation, read MT2 + MT1]
  C --> D{heading candidates}
  D --> E[VisionHeadingSelector<br/>stick with one camera]
  E --> F[Stationary? VisionHeadingInitializer<br/>stable window → resetRotation if error > 5°]
  E --> G[VisionMeasurementFusion.addHeading<br/>gradual 20° std-dev correction]
  G --> H[VisionHeadingReadiness<br/>confirm heading established]
  C --> I{position candidates}
  I --> J[fusion.isNewPosition → samplePoseAt capture time]
  J --> K[VisionPoseFilter.acceptPosition<br/>bounds, height, ≤1 m or 3-frame recovery]
  K --> L[fusion.addPosition → Swerve.addVisionMeasurement]
  F & G & L --> M[SignalLogger Vision/* status]
```

## Key rules
- **Position fusion waits until heading is trusted.** Heading becomes trusted through disabled initialization, stationary recovery, fusion readiness, or an explicit reset.
- **MT2 frames captured before a heading correction is published are discarded.** They used the old heading.
- **Test mode** suppresses heading init and correction. `setShouldUpdatePose(false)` suppresses everything, but frames are still consumed.
- **History lookup:** `Swerve.samplePoseAt` and `addVisionMeasurement` convert FPGA time with `Utils.fpgaToCurrentTime`.

Class details: [Vision Pipeline](../03-PowerLib/Vision%20Pipeline.md). Thresholds: [Configs](../03-PowerLib/Configs.md).

Related: [Vision Pipeline](../03-PowerLib/Vision%20Pipeline.md), [Robot Templates](../04-Robot-Templates/Robot%20Templates.md), [Telemetry and Logging](../03-PowerLib/Telemetry%20and%20Logging.md)
