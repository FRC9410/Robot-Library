import type { NtPrimitive, NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { stringifyValue } from "../subsystems/subsystemUtils";

export const tuningModeTopicName = "/PowerLib/Tuning/Enabled";
export const tuningModeRequestTopicName = "/PowerLib/Tuning/RequestedEnabled";
export const tunablePathMarker = "/Variables/";

export function getWritableTopicType(topic: NtTopicSnapshot): NtTopicType | null {
  switch (topic.type) {
    case "boolean":
    case "double":
    case "int":
    case "string":
      return topic.type;
    default:
      return null;
  }
}

export function isTunableTopic(topic: NtTopicSnapshot) {
  return topic.name.includes(tunablePathMarker) && getWritableTopicType(topic) !== null;
}

export function topicValueToDraft(value: NtTopicSnapshot["value"]) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return typeof value === "string" || typeof value === "number" ? String(value) : stringifyValue(value);
}

export function parseDraftValue(type: NtTopicType, draft: string): NtPrimitive {
  if (type === "string") {
    return draft;
  }

  if (type === "boolean") {
    const normalized = draft.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }

    throw new Error("Use true/false, yes/no, on/off, or 1/0 for booleans.");
  }

  const parsed = Number(draft);
  if (!Number.isFinite(parsed)) {
    throw new Error(`"${draft}" is not a valid ${type} value.`);
  }
  if (type === "int" && !Number.isInteger(parsed)) {
    throw new Error(`"${draft}" is not a valid integer value.`);
  }

  return parsed;
}
