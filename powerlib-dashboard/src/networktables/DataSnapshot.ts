import type { NtTopicSnapshot, NtValue } from "./nt4Client";

export const dataSnapshotTopic = "/PowerLib/Data";
export const isSubsystemDataTopic = (name: string) => /^\/PowerLib\/Subsystems\/[^/]+\/Data(?:\/|$)/.test(name);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Decode a complete frame before replacing any dashboard readings. Malformed frames do not refresh freshness. */
export function decodeDataSnapshot(snapshot: NtTopicSnapshot, receivedAt: number): NtTopicSnapshot[] | null {
  if (typeof snapshot.value !== "string") return null;
  try {
    const frame: unknown = JSON.parse(snapshot.value);
    if (!record(frame) || frame.schemaVersion !== 1 || !Number.isSafeInteger(frame.sequence)
        || (frame.sequence as number) < 0 || typeof frame.timestampSeconds !== "number"
        || !Number.isFinite(frame.timestampSeconds) || !record(frame.subsystems)) return null;
    const fields: NtTopicSnapshot[] = [];
    for (const [subsystem, metrics] of Object.entries(frame.subsystems)) {
      if (!subsystem.trim() || subsystem.includes("/") || !record(metrics)) return null;
      for (const [key, value] of Object.entries(metrics)) {
        if (!key.trim()) return null;
        let type: string;
        let decoded: NtValue;
        if (record(value) || (subsystem === "Drive" && key === "Pose")) {
          type = "struct:Pose2d";
          if (value === null) decoded = null;
          else {
            if (!record(value) || ![value.xMeters, value.yMeters, value.headingRadians]
              .every(number => typeof number === "number" && Number.isFinite(number))) return null;
            const bytes = new ArrayBuffer(24);
            const view = new DataView(bytes);
            view.setFloat64(0, value.xMeters as number, true);
            view.setFloat64(8, value.yMeters as number, true);
            view.setFloat64(16, value.headingRadians as number, true);
            decoded = bytes;
          }
        } else if (value === null) { type = "double"; decoded = null; }
        else if (typeof value === "boolean" || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
          type = typeof value === "number" ? "double" : typeof value;
          decoded = value;
        } else return null;
        fields.push({ name: `/PowerLib/Subsystems/${subsystem}/Data/${key}`, type, value: decoded,
          lastChangedTime: snapshot.lastChangedTime, receivedAt });
      }
    }
    return fields;
  } catch { return null; }
}
