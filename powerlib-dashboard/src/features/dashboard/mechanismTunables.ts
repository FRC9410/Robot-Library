import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { GeneratedSubsystem } from "../subsystems/types";
import { subsystemTuningChanges, subsystemTuningValues, type SubsystemSetting } from "./subsystemTunables";

export const sharedMechanismSettings: SubsystemSetting[] = [
  { key: "PID/kP", group: "PID", label: "kP" },
  { key: "PID/kI", group: "PID", label: "kI" },
  { key: "PID/kD", group: "PID", label: "kD" },
  { key: "PID/kG", group: "PID", label: "kG" },
  { key: "Feedforward/kS", group: "Feedforward", label: "kS" },
  { key: "Feedforward/kV", group: "Feedforward", label: "kV" },
  { key: "Feedforward/kA", group: "Feedforward", label: "kA" },
  { key: "MotionMagic/CruiseVelocity", group: "Motion Magic", label: "Cruise velocity" },
  { key: "MotionMagic/Acceleration", group: "Motion Magic", label: "Acceleration" }
];
const sensorSettings: SubsystemSetting[] = [
  { key: "Cancoder/MagnetOffset", group: "Sensor", label: "Magnet offset (rotations)" },
  { key: "Cancoder/DiscontinuityPoint", group: "Sensor", label: "Discontinuity point (rotations)" }
];
const excludedOwners = new Set(["drive", "drivetrain", "swerve", "vision", "led", "leds"]);

export function canTuneMechanism(owner: string) {
  return !excludedOwners.has(owner.replace(/[^a-z0-9]/gi, "").toLowerCase());
}

export function mechanismTuningValues(owner: string, topics: NtTopicSnapshot[], subsystems: GeneratedSubsystem[] = []) {
  const byName = new Map(topics.map(topic => [topic.name, topic]));
  const variablesPrefix = `/PowerLib/Subsystems/${owner}/Variables/`;
  const normalize = (name: string) => name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const subsystem = subsystems.find(config => normalize(config.name || config.id || "") === normalize(owner));
  const torque: SubsystemSetting[] = subsystem?.type?.toLowerCase() === "velocitytorque"
    ? [{ key: "Feedforward/Torque", group: "Feedforward", label: "Torque FF" }] : [];
  const position: SubsystemSetting[] = byName.has(`${variablesPrefix}Position/Default`)
    ? [{ key: "Position/Default", group: "Position", label: "Default position (rotations)" }] : [];
  const sensor = sensorSettings.some(setting => byName.has(`${variablesPrefix}${setting.key}`)) ? sensorSettings : [];
  return subsystemTuningValues(owner, topics, [...sharedMechanismSettings, ...torque, ...position, ...sensor]);
}

/** Validate the entire staged edit before publishing any part of it. */
export function mechanismTuningChanges(owner: string, topics: NtTopicSnapshot[], drafts: Record<string, string>, subsystems: GeneratedSubsystem[] = []) {
  if (!canTuneMechanism(owner)) return { changes: [], errors: { owner: "This card does not expose mechanism tuning." } };
  return subsystemTuningChanges(mechanismTuningValues(owner, topics, subsystems), drafts);
}
