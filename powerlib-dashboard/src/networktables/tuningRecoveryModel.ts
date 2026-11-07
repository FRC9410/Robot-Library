import type { TuningSessionValue } from "../../electron/tuningSession";
import type { NtTopicSnapshot } from "./nt4Client";
export function tuningRecoveryDrafts(values: TuningSessionValue[], rows: Array<{ key: string; baseline: string; writable: boolean; topic?: NtTopicSnapshot }>, drafts: Record<string, string>) {
  const saved = new Map(values.map(value => [value.name, value]));
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (!row.writable || !row.topic || drafts[row.key] !== undefined) continue;
    const value = saved.get(row.topic.name);
    if (value && value.type === row.topic.type && value.value !== row.topic.value && String(value.value) !== row.baseline) result[row.key] = String(value.value);
  }
  return result;
}
