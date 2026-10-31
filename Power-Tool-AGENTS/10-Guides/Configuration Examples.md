---
title: Configuration Examples
date: 2026-10-30
tags: [guide, configuration, json]
---

# Configuration Examples

Copyable `power-tool/generated/powerlib-subsystems.json` entries for all four types, plus the
saved-constants format. Edit them in Power Tool's Subsystems tab, or by hand, then run
**Update Code**. Normalization rules live in `Normalize-SubsystemConfig` in
`generate-subsystem.ps1`; validation runs in the `frc.powerlib.configs` record constructors when
the robot starts.

> [!NOTE]
> Write numbers as **strings** (`"0.15"`), the same way the generator writes its defaults. They're
> pasted into Java as-is, so they must be valid Java number literals.

## Fields shared by every type
| Field | Required | Default | Limits |
|---|---|---|---|
| `id` | no (derived) | camelCase of `name` | stable; **keep it when renaming** |
| `name` | yes | — | one token, no spaces or `/`; not a reserved name (CanBus, GeneratedTunable, LED, Location, OI, RobotContainer, StateMachine, Swerve, Tuner, Vision) |
| `type` | yes | — | `velocity`, `velocityTorque`, `absolutePosition`, `relativePosition` |
| `motors[]` | yes | role: first = leader, rest = followers; `reversed: false`; followers inherit the leader's `neutralMode` | `id` 0–62, unique; exactly one leader; `neutralMode` `Brake`/`Coast` |
| `pid.kP kI kD kG` | no | `"0.0"` | finite |
| `pid.kS kV kA` | no | `null` → `Optional.empty()` | finite if set |
| `ratios.sensorToMechanism`, `ratios.rotorToSensor` | no | `"1.0"` | non-zero, abs ≤ 1000 |
| `motionMagic.cruiseVelocity`, `.acceleration` | no | `"0.0"` | ≥ 0 |
| `focEnabled` | no | `true` | |
| `torqueFF` | no | `"0.0"` | finite; used by `velocityTorque` with FOC |
| `statorCurrentLimitAmps` | no | `""` = Phoenix default | > 0; **velocity types only** |

## velocity
```json
{
  "id": "intakeRoller",
  "name": "IntakeRoller",
  "type": "velocity",
  "motors": [
    { "role": "leader", "id": 20, "neutralMode": "Coast", "reversed": false },
    { "role": "follower", "id": 21, "reversed": true }
  ],
  "pid": { "kP": "0.1", "kI": "0.0", "kD": "0.0", "kG": "0.0", "kS": "0.2", "kV": "0.12", "kA": null },
  "ratios": { "sensorToMechanism": "3.0", "rotorToSensor": "1.0" },
  "motionMagic": { "cruiseVelocity": "0.0", "acceleration": "200.0" },
  "focEnabled": true,
  "torqueFF": "0.0",
  "statorCurrentLimitAmps": "40.0"
}
```
A follower with `"reversed": true` spins opposite the leader (`MotorAlignmentValue.Opposed`).

## velocityTorque
Same fields as `velocity`. With FOC on, it uses `VelocityTorqueCurrentFOC` plus `torqueFF` (amps).
```json
{
  "id": "shooter",
  "name": "Shooter",
  "type": "velocityTorque",
  "motors": [{ "role": "leader", "id": 30, "neutralMode": "Coast", "reversed": false }],
  "pid": { "kP": "5.0", "kI": "0.0", "kD": "0.0", "kG": "0.0", "kS": "2.0", "kV": null, "kA": null },
  "ratios": { "sensorToMechanism": "1.0", "rotorToSensor": "1.0" },
  "motionMagic": { "cruiseVelocity": "0.0", "acceleration": "300.0" },
  "focEnabled": true,
  "torqueFF": "8.0",
  "statorCurrentLimitAmps": "60.0"
}
```

## absolutePosition (fused CANcoder)
```json
{
  "id": "wrist",
  "name": "Wrist",
  "type": "absolutePosition",
  "motors": [{ "role": "leader", "id": 40, "neutralMode": "Brake", "reversed": false }],
  "pid": { "kP": "40.0", "kI": "0.0", "kD": "0.5", "kG": "0.3", "kS": "0.1", "kV": null, "kA": null },
  "ratios": { "sensorToMechanism": "1.0", "rotorToSensor": "45.0" },
  "motionMagic": { "cruiseVelocity": "2.0", "acceleration": "6.0" },
  "focEnabled": true,
  "absolutePosition": { "units": "rotations", "default": "0.25" },
  "cancoder": { "id": 41, "magnetOffset": "-0.137", "discontinuityPoint": "0.5" }
}
```
- `absolutePosition.units` defaults to `"rotations"` and is a label only (see [Units and Coordinates](Units%20and%20Coordinates.md)).
- `absolutePosition.default` (null = hold the current position at startup) is where it goes on boot.
- `cancoder.magnetOffset` must be in [-1, 1] (default `"0.0"`). `discontinuityPoint` must be in [0, 1] (default `"0.5"`).
- Legacy `"type": "position"` is converted to this type.

## relativePosition (motor encoder, soft limits)
```json
{
  "id": "elevator",
  "name": "Elevator",
  "type": "relativePosition",
  "motors": [
    { "role": "leader", "id": 50, "neutralMode": "Brake", "reversed": false },
    { "role": "follower", "id": 51, "reversed": true }
  ],
  "pid": { "kP": "8.0", "kI": "0.0", "kD": "0.1", "kG": "0.35", "kS": "0.15", "kV": "0.11", "kA": null },
  "ratios": { "sensorToMechanism": "12.0", "rotorToSensor": "1.0" },
  "motionMagic": { "cruiseVelocity": "8.0", "acceleration": "20.0" },
  "slowMotionMagic": { "cruiseVelocity": "4.0", "acceleration": "8.0" },
  "focEnabled": true,
  "relativePosition": {
    "units": "rotations",
    "homePosition": "0.0",
    "forwardSoftLimit": "5.2",
    "reverseSoftLimit": "0.0",
    "slowThreshold": "0.0",
    "tolerance": "0.05",
    "stopVoltage": "0.0"
  }
}
```
- Requires `reverseSoftLimit ≤ homePosition ≤ forwardSoftLimit` and `tolerance > 0`.
- At startup the current encoder reading is *declared* to be `homePosition`; nothing physically homes the mechanism. **Boot the mechanism at home**, or re-zero it at a known position.
- `slowMotionMagic` is used for moves **down or to an equal position**. `slowThreshold` is kept only for compatibility and selects nothing (see [Mechanism Behavior](../03-PowerLib/Mechanism%20Behavior.md)).
- `stopVoltage` is applied by `stop()`. For example, a small hold voltage against gravity.

## Renaming without losing anything
Change `name`, keep `id`:
```diff
-  "id": "intakeRoller", "name": "IntakeRoller",
+  "id": "intakeRoller", "name": "FloorIntake",
```
Update Code then:
- writes `FloorIntakeConstants.java`, carrying the custom block over by id;
- deletes `IntakeRollerConstants.java`;
- renames the `StateMachine` field to `floorIntake`.

**Then fix your own references** (`stateMachine.intakeRoller` → `stateMachine.floorIntake`). The
NT/log owner name also changes to `FloorIntake`, so update dashboards and log queries.

## `swerve` section
Generated defaults are shown below. They're written into `SwerveConstants.java`, and the same
values are tunable at runtime.
```json
"swerve": {
  "driver": { "maxSpeedCoefficient": 0.75, "velocityScale": 0.95, "maxAngularRateRadiansPerSecond": 9.42477796076938, "joystickDeadband": 0.1, "skewCompensation": -0.03 },
  "requests": { "maxAngularRateRadiansPerSecond": 4.71238898038469, "translationDeadbandMetersPerSecond": 0.572, "rotationalDeadbandRadiansPerSecond": 0.471238898038469 },
  "driveToPoint": { "maxAngularRateRadiansPerSecond": 3.141592653589793, "maxSpeedCoefficient": 0.75, "slowSpeedCoefficient": 0.1875, "staticFrictionConstant": 0.085 },
  "heading": { "kP": 7.0, "kI": 0.0, "kD": 0.0 }
}
```

## `powerlib-constants.json` (saved constants)
```json
{
  "version": 1,
  "files": {
    "robot:Shooting": {
      "constants": [
        { "name": "SPIN_UP_RPS", "type": "double", "value": "55.0", "custom": true, "tunable": true },
        { "name": "AUTO_AIM", "type": "boolean", "value": "true", "custom": true, "tunable": false }
      ]
    },
    "subsystem:intakeRoller": {
      "constants": [
        { "name": "INTAKE_SPEED_RPS", "type": "double", "value": "40.0", "custom": true, "tunable": true }
      ]
    }
  }
}
```
- Keys:
  - `robot:<Name>` for `constants/<Name>Constants.java` (Vision, StateMachine, OI, RobotContainer, Swerve, plus any team file like `ShootingConstants`);
  - `subsystem:<id>` for generated subsystem files (custom constants only).
- `custom: true` rows are written inside the custom block. Non-custom rows replace existing declarations in place, and their type must match.
- `tunable` is true for numeric types (byte, short, int, long, float, double and boxed versions).
- **What Power Tool's UI can do:** the Robot-tab drawer only **edits values of existing constants**. It doesn't add, delete, rename or retype them. To add a constant, write the row into this file by hand and run Update Code.
- The underlying save API (`saveConstants` in `electron/constantsFiles.ts`) can technically accept added or retyped custom rows, limited to `String`, `boolean`, `int` and `double`. The UI doesn't expose that, so treat it as internal.

Related: [Subsystem Generator](../02-Install-and-Update/Subsystem%20Generator.md), [File Ownership and Precedence](File%20Ownership%20and%20Precedence.md), [Configs](../03-PowerLib/Configs.md), [Units and Coordinates](Units%20and%20Coordinates.md)
