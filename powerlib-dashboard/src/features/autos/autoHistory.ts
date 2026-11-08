import type { AutoDocument } from "./autoModel";

/** Bounded document history. A pointer gesture is one edit even with hundreds of updates. */
export class AutoHistory {
  past: AutoDocument[] = [];
  future: AutoDocument[] = [];
  private gesture: AutoDocument | null = null;
  constructor(public document: AutoDocument) {}
  get canUndo() { return this.past.length > 0 || (this.gesture !== null && this.gesture !== this.document); }
  get canRedo() { return this.future.length > 0; }
  get gesturing() { return this.gesture !== null; }
  reset(document: AutoDocument) { this.document = document; this.past = []; this.future = []; this.gesture = null; }
  begin() { if (!this.gesture) this.gesture = this.document; }
  end(cancel = false) {
    if (!this.gesture) return;
    const before = this.gesture; this.gesture = null;
    if (cancel) this.document = before;
    else if (JSON.stringify(before) !== JSON.stringify(this.document)) { this.remember(before); this.future = []; }
  }
  private remember(document: AutoDocument) { this.past = [...this.past.slice(-99), document]; }
  update(update: AutoDocument | ((document: AutoDocument) => AutoDocument)) {
    const next = typeof update === "function" ? update(this.document) : update;
    if (JSON.stringify(next) === JSON.stringify(this.document)) return;
    if (!this.gesture) { this.remember(this.document); this.future = []; }
    this.document = next;
  }
  undo() { this.end(); const previous = this.past.pop(); if (previous) { this.future.push(this.document); this.document = previous; } }
  redo() { this.end(); const next = this.future.pop(); if (next) { this.remember(this.document); this.document = next; } }
}
