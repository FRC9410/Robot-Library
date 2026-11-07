import type { NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { getWritableTopicType, parseDraftValue, topicValueToDraft } from "../networktables/tuningUtils";

type MechanismSetting = { key: string; group: string; label: string; boolean?: boolean; string?: boolean };
export const sharedMechanismSettings: MechanismSetting[] = [
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
const sensorSettings: MechanismSetting[] = [
  { key: "Cancoder/MagnetOffset", group: "Sensor", label: "Magnet offset (rotations)" },
  { key: "Cancoder/DiscontinuityPoint", group: "Sensor", label: "Discontinuity point (rotations)" }
];
const excludedOwners = new Set(["drive", "drivetrain", "swerve", "vision", "led", "leds"]);

export function canTuneMechanism(owner: string) {
  return !excludedOwners.has(owner.replace(/[^a-z0-9]/gi, "").toLowerCase());
}

export function mechanismTuningValues(owner: string, topics: NtTopicSnapshot[]) {
  const byName = new Map(topics.map(topic => [topic.name, topic]));
  const variablesPrefix = `/PowerLib/Subsystems/${owner}/Variables/`;
  const sensor = sensorSettings.some(setting => byName.has(`${variablesPrefix}${setting.key}`)) ? sensorSettings : [];
  const customPrefix = `/PowerLib/Subsystems/${owner}/Variables/Custom/`;
  const custom: MechanismSetting[] = [...byName.values()]
    .filter(topic => topic.name.startsWith(customPrefix) && topic.name.length > customPrefix.length && getWritableTopicType(topic))
    .map(topic => ({ key: `Custom/${topic.name.slice(customPrefix.length)}`, group: "Custom",
      label: topic.name.slice(customPrefix.length).replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
      boolean: topic.type === "boolean", string: topic.type === "string" }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return [...sharedMechanismSettings, ...sensor, ...custom].map(setting => {
    const topic = byName.get(`/PowerLib/Subsystems/${owner}/Variables/${setting.key}`);
    const writable = !!topic && (setting.boolean
      ? topic.type === "boolean" && typeof topic.value === "boolean"
      : setting.string ? topic.type === "string" && typeof topic.value === "string"
      : (topic.type === "double" || topic.type === "int") && typeof topic.value === "number" && Number.isFinite(topic.value));
    return { ...setting, topic, writable, baseline: topic ? topicValueToDraft(topic.value) : "" };
  });
}

/** Validate the entire staged edit before publishing any part of it. */
export function mechanismTuningChanges(owner: string, topics: NtTopicSnapshot[], drafts: Record<string, string>) {
  const changes: { key: string; draft: string; topic: NtTopicSnapshot; type: NtTopicType; value: number | boolean | string }[] = [];
  const errors: Record<string, string> = {};
  if (!canTuneMechanism(owner)) return { changes, errors: { owner: "This card does not expose mechanism tuning." } };
  for (const row of mechanismTuningValues(owner, topics)) {
    const draft = drafts[row.key];
    if (draft === undefined || draft === row.baseline) continue;
    if (!row.topic || !row.writable) { errors[row.key] = "This setting is not currently published by the robot."; continue; }
    try {
      const type = row.topic.type as NtTopicType;
      changes.push({ key: row.key, draft, topic: row.topic, type, value: parseDraftValue(type, draft) });
    } catch (error) { errors[row.key] = error instanceof Error ? error.message : "Enter a valid value."; }
  }
  return { changes: Object.keys(errors).length ? [] : changes, errors };
}
