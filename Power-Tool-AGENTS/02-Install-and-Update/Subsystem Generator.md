---
title: Subsystem Generator
date: 2026-10-30
tags: [generator, powershell, codegen]
---

# Subsystem Generator

`generate-subsystem.ps1` (~2000 lines of PowerShell) turns
`power-tool/generated/powerlib-subsystems.json` and `powerlib-constants.json` into robot Java code.
Power Tool's **File → Update Code** runs it as
`generate-subsystem.ps1 -UpdateSubsystems -SubsystemsJson <path>`. The end-to-end story is in
[Code Generation Flow](../06-Data-Flows/Code%20Generation%20Flow.md).

## Modes
- `-UpdateSubsystems`: regenerate from the JSON, then build. This is what Power Tool uses.
- **Interactive** (no flag): if the JSON exists it asks "Update subsystems from …?". Otherwise it prompts for subsystem fields in a loop.
- `-SkipBuild` skips the closing `gradlew build`.
- Wrappers: `power-tool/scripts/powerlib-generate-subsystem.cmd` and `powerlib-update-subsystems.cmd`.

## `powerlib-subsystems.json`

```jsonc
{
  "swerve": { "driver": {...}, "requests": {...}, "driveToPoint": {...}, "heading": {"kP": 7.0, ...} },
  "subsystems": [{
    "id": "intakeRoller",          // stable; rename via "name", keep the id
    "name": "IntakeRoller",        // one token, no spaces
    "type": "velocity",            // velocity | velocityTorque | absolutePosition | relativePosition
    "motors": [{"role": "leader", "id": 20, "neutralMode": "Brake", "reversed": false}],
    "pid": {"kP": "0.0", "kI": "0.0", "kD": "0.0", "kG": "0.0", "kS": null, "kV": null, "kA": null},
    "ratios": {"sensorToMechanism": "1.0", "rotorToSensor": "1.0"},
    "motionMagic": {"cruiseVelocity": "0.0", "acceleration": "0.0"},
    "focEnabled": true, "torqueFF": "0.0",
    "statorCurrentLimitAmps": ""   // velocity types only; "" = Phoenix default
    // absolutePosition: "absolutePosition": {...}, "cancoder": {id, magnetOffset, discontinuityPoint}
    // relativePosition: "relativePosition": {...}, "slowMotionMagic": {...}
  }]
}
```

- Exactly one leader motor is required. Followers inherit the leader's neutral mode.
- Legacy `type: "position"` is converted to `absolutePosition`.
- Reserved names (rejected): CanBus, GeneratedTunable, LED, Location, OI, RobotContainer, StateMachine, Swerve, Tuner, Vision.

## What an update writes, in order
1. **Collect:** gather the custom-constant blocks from the existing generated files, keyed by subsystem id. On first run, import the existing Java constants into `powerlib-constants.json`.
2. **Write constants files:**
   - `constants/SwerveConstants.java` from the `swerve` section.
   - Per subsystem, `constants/<Name>Constants.java` with motor IDs, gains, ratios and `<PREFIX>_CONFIG` (a `VelocitySubsystemConfig` etc.). The custom block is put back.
3. **Characterization:** velocity types also get `characterization/<Name>Characterization.java` (a SysId routine), registered in `PowerDashboard`.
4. **Rewrite marker blocks:**
   - `Constants.java` barrel: one alias per subsystem between `POWERLIB GENERATED CONSTANTS` markers.
   - `StateMachine.java`: `public final VelocitySubsystem intakeRoller = new VelocitySubsystem(Constants.IntakeRoller.INTAKE_ROLLER_CONFIG);` between `POWERLIB GENERATED SUBSYSTEMS` markers.
5. **Run idempotent migrations** on `PowerDashboard`, `StateMachine` and `Swerve`. These upgrade older projects to the current telemetry, tuning and cadence code.
6. **Apply saved constants:** write the values from `powerlib-constants.json` into the Java files.
   - Numeric constants become `@TunableConstant public static volatile`.
   - Once a file has an entry in the JSON, the custom block is regenerated from it, so **the JSON wins**.
7. **Register tunables:** regenerate `constants/GeneratedTunableConstants.java` with `TunableConstants.register(XConstants.class)` for each file.
8. **Clean up and save:** delete generated files whose JSON entry is gone, then save the normalized JSON.

## Markers you must not delete
- `// POWERLIB GENERATED SUBSYSTEMS START/END - DO NOT DELETE` (StateMachine)
- `// POWERLIB GENERATED CONSTANTS START/END - DO NOT DELETE` (Constants)
- `// POWERLIB GENERATED CHARACTERIZATION START/END - DO NOT DELETE` (PowerDashboard)
- `// POWERLIB CUSTOM CONSTANTS START/END - DO NOT DELETE` (each constants file). Hand-written constants go here.

Related: [Code Generation Flow](../06-Data-Flows/Code%20Generation%20Flow.md), [Tuning Round Trip](../06-Data-Flows/Tuning%20Round%20Trip.md), [Subsystems and IO](../03-PowerLib/Subsystems%20and%20IO.md), [Robot Templates](../04-Robot-Templates/Robot%20Templates.md)
