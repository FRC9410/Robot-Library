---
title: Health, Math and Utils
date: 2026-10-30
tags: [powerlib, utilities]
---

# Health, Math and Utils

## `health/HealthChecks`
Static checks shared by vision and robot code:
- `finitePose(pose)`: non-null with finite x, y and heading.
- `isFresh(age, maxAge)`.
- `signalHealthy(BaseStatusSignal, maxAge)`: status OK, valid timestamp, fresh.
- `mechanismHealthy(PowerSubsystem, TalonFX, maxAge)`: always false for a null or unconfigured mechanism, **including in simulation**. On a real robot it also needs the motor connected, with fresh position and velocity. Sim skips only the motor and signal checks.
- `driveHealthy(SwerveDrivetrain, maxAge)`: finite pose; on a real robot also Pigeon yaw plus every module's drive, steer and CANcoder signals.

Used by every vision class, the template `Vision` (gyro health) and `Swerve` (pose-reset guard).

## `math/LinearInterpolator`
Clamped piecewise-linear lookup table (e.g. shooter speed vs. distance). Rows are `{x, y}`, sorted
on construction; duplicate x values throw. `getInterpolatedValue(x)`. Not used by the templates yet.

## `utils/DriveUtil`
**Not standalone:** it imports `frc.robot.Constants`, `SwerveConstants` and `Swerve`. That's why
the library test compile skips `utils/`.
- `calculateSpeedsBasedOnJoystickInputs(controller, swerve, maxAngularRate, skew)`: deadband, cubic translation and squared rotation shaping, skew compensation. Used by `SwerveDriveCommand`.
- `calculateDriveToPointVelocity(...)`: PID plus static-friction feedforward, slowing down when close.
- `syncTunableValues()`: reads the `Swerve/DriveToPoint/*` tunables at 5 Hz.

Related: [Vision Pipeline](Vision%20Pipeline.md), [Subsystems and IO](Subsystems%20and%20IO.md), [Robot Templates](../04-Robot-Templates/Robot%20Templates.md)
