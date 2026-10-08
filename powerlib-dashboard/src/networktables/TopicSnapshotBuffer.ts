import type { NtTopicSnapshot } from "./nt4Client";
import { dataSnapshotTopic, decodeDataSnapshot, isSubsystemDataTopic } from "./DataSnapshot";

/** Retains the latest complete data object plus unrelated topics between screen updates. */
export class TopicSnapshotBuffer {
  private topics = new Map<string, NtTopicSnapshot>();
  private data: NtTopicSnapshot[] | null = null;
  private pending = false;
  telemetryError: string | null = null;

  upsert(snapshot: NtTopicSnapshot, receivedAt: number) {
    if (snapshot.name === dataSnapshotTopic) {
      const data = decodeDataSnapshot(snapshot, receivedAt);
      if (data === null) {
        this.telemetryError = "Unsupported telemetry frame. Showing the last valid readings until a valid frame arrives.";
        return;
      }
      this.telemetryError = null;
      if (this.data === null) {
        // Discard legacy per-field telemetry when the new complete-object publisher appears.
        for (const name of this.topics.keys()) if (isSubsystemDataTopic(name)) this.topics.delete(name);
      }
      this.data = data; // Replace everything, including fields removed from the new map.
    } else if (this.data !== null && isSubsystemDataTopic(snapshot.name)) {
      return; // The separate AdvantageScope pose/old scalar topics cannot mix frames or freshness.
    }
    this.topics.set(snapshot.name, { ...snapshot, receivedAt });
    this.pending = true;
  }

  values() {
    return [...this.topics.values(), ...(this.data ?? [])];
  }

  retain(predicate: (snapshot: NtTopicSnapshot) => boolean) {
    for (const [name, snapshot] of this.topics) {
      if (!predicate(snapshot)) { this.topics.delete(name); this.pending = true; }
    }
  }

  replace(snapshots: NtTopicSnapshot[]) {
    this.telemetryError = null;
    this.topics = new Map(snapshots.map(snapshot => [snapshot.name, snapshot]));
    this.data = null;
    this.pending = false;
  }

  flush() {
    if (!this.pending) return null;
    this.pending = false;
    return this.values();
  }
}
