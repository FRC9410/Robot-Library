import type { NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { getWritableTopicType, parseDraftValue, topicValueToDraft } from "../networktables/tuningUtils";

export type SubsystemSetting = { key: string; group: string; label: string; boolean?: boolean; string?: boolean;
  min?: number; max?: number; exclusiveMin?: boolean };

export function subsystemTuningValues(owner: string, topics: NtTopicSnapshot[], settings: SubsystemSetting[]) {
  const byName = new Map(topics.map(topic => [topic.name, topic]));
  const prefix = `/PowerLib/Subsystems/${owner}/Variables/`;
  const customPrefix = `${prefix}Custom/`;
  const custom: SubsystemSetting[] = [...byName.values()]
    .filter(topic => topic.name.startsWith(customPrefix) && topic.name.length > customPrefix.length && getWritableTopicType(topic))
    .map(topic => ({ key: `Custom/${topic.name.slice(customPrefix.length)}`, group: "Custom",
      label: topic.name.slice(customPrefix.length).replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
      boolean: topic.type === "boolean", string: topic.type === "string" }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return [...settings, ...custom].map(setting => {
    const topic = byName.get(`${prefix}${setting.key}`);
    const writable = !!topic && (setting.boolean
      ? topic.type === "boolean" && typeof topic.value === "boolean"
      : setting.string ? topic.type === "string" && typeof topic.value === "string"
      : (topic.type === "double" || topic.type === "int") && typeof topic.value === "number" && Number.isFinite(topic.value));
    return { ...setting, topic, writable, baseline: topic ? topicValueToDraft(topic.value) : "" };
  });
}

/** Validate the entire staged edit before publishing any part of it. */
export function subsystemTuningChanges(rows: ReturnType<typeof subsystemTuningValues>, drafts: Record<string, string>) {
  const changes: { key: string; draft: string; topic: NtTopicSnapshot; type: NtTopicType; value: number | boolean | string }[] = [];
  const errors: Record<string, string> = {};
  for (const row of rows) {
    const draft = drafts[row.key];
    if (draft === undefined || draft === row.baseline) continue;
    if (!row.topic || !row.writable) { errors[row.key] = "This setting is not currently published by the robot."; continue; }
    try {
      const type = row.topic.type as NtTopicType;
      const value = parseDraftValue(type, draft);
      if (typeof value === "number") {
        if (row.min !== undefined && (row.exclusiveMin ? value <= row.min : value < row.min)) throw Error(`Enter a value ${row.exclusiveMin ? "greater than" : "at least"} ${row.min}.`);
        if (row.max !== undefined && value > row.max) throw Error(`Enter a value at most ${row.max}.`);
      }
      changes.push({ key: row.key, draft, topic: row.topic, type, value });
    } catch (error) { errors[row.key] = error instanceof Error ? error.message : "Enter a valid value."; }
  }
  return { changes: Object.keys(errors).length ? [] : changes, errors };
}
