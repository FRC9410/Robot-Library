import type { NtTopicSnapshot } from "./nt4Client";

/** Keeps the latest readings between screen updates, without queuing old samples. */
export class TopicSnapshotBuffer {
  private topics = new Map<string, NtTopicSnapshot>();
  private pending = false;

  upsert(snapshot: NtTopicSnapshot, receivedAt: number) {
    this.topics.set(snapshot.name, { ...snapshot, receivedAt });
    this.pending = true;
  }

  values() {
    return Array.from(this.topics.values());
  }

  replace(snapshots: NtTopicSnapshot[]) {
    this.topics = new Map(snapshots.map(snapshot => [snapshot.name, snapshot]));
    this.pending = false;
  }

  flush() {
    if (!this.pending) return null;
    this.pending = false;
    return this.values();
  }
}
