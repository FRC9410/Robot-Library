import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import { subsystemTuningChanges, subsystemTuningValues, type SubsystemSetting } from "./subsystemTunables";

// Pose telemetry is published under Drive; the robot owns these variables under Swerve.
export const drivetrainTuningOwner = "Swerve";
export const drivetrainSettings: SubsystemSetting[] = [
  { key: "Driver/MaxSpeedCoefficient", group: "Driver", label: "Max speed coefficient" },
  { key: "Driver/VelocityScale", group: "Driver", label: "Velocity scale" },
  { key: "Driver/MaxAngularRateRadiansPerSecond", group: "Driver", label: "Max angular rate (rad/s)" },
  { key: "Driver/JoystickDeadband", group: "Driver", label: "Joystick deadband" },
  { key: "Driver/SkewCompensation", group: "Driver", label: "Skew compensation" },
  { key: "Requests/MaxAngularRateRadiansPerSecond", group: "Requests", label: "Max angular rate (rad/s)" },
  { key: "Requests/TranslationDeadbandMetersPerSecond", group: "Requests", label: "Translation deadband (m/s)" },
  { key: "Requests/RotationalDeadbandRadiansPerSecond", group: "Requests", label: "Rotational deadband (rad/s)" },
  { key: "DriveToPoint/MaxAngularRateRadiansPerSecond", group: "Drive to Point", label: "Max angular rate (rad/s)" },
  { key: "DriveToPoint/MaxSpeedCoefficient", group: "Drive to Point", label: "Max speed coefficient" },
  { key: "DriveToPoint/SlowSpeedCoefficient", group: "Drive to Point", label: "Slow speed coefficient" },
  { key: "DriveToPoint/StaticFrictionConstant", group: "Drive to Point", label: "Static friction constant" },
  { key: "Heading/kP", group: "Heading PID", label: "kP" },
  { key: "Heading/kI", group: "Heading PID", label: "kI" },
  { key: "Heading/kD", group: "Heading PID", label: "kD" }
];
export const localizationSettings: SubsystemSetting[] = [
  { key: "Position/TargetAreaThreshold", group: "Localization", label: "Target area threshold (%)", min: 0, max: 100 },
  { key: "Position/MaxTargetDistanceMeters", group: "Localization", label: "Maximum target distance (m)", min: 0, exclusiveMin: true },
  { key: "Heading/MaxTagDistanceMeters", group: "Localization", label: "Heading max tag distance (m)", min: 0, exclusiveMin: true },
  { key: "Heading/SingleTagMaxDistanceMeters", group: "Localization", label: "Single-tag heading max distance (m)", min: 0, exclusiveMin: true }
];

export function drivetrainTuningValues(topics: NtTopicSnapshot[]) {
  return [...subsystemTuningValues(drivetrainTuningOwner, topics, drivetrainSettings),
    ...subsystemTuningValues("Vision", topics, localizationSettings).filter(row => row.group === "Localization")];
}

export function drivetrainTuningChanges(topics: NtTopicSnapshot[], drafts: Record<string, string>) {
  return subsystemTuningChanges(drivetrainTuningValues(topics), drafts);
}
