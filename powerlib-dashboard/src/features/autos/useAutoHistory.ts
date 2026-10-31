import { useCallback, useState } from "react";
import type { AutoDocument } from "./autoModel";
import { emptyDocument } from "./autoModel";

/** Edits with the same key this close together become one undo step, such as a drag or typing in one field. */
const coalesceMilliseconds = 800;
const maxUndoSteps = 200;

type History = {
  past: AutoDocument[];
  present: AutoDocument;
  future: AutoDocument[];
  lastKey: string | null;
  lastAt: number;
};

/** Undo/redo for the Auto Builder document. Loading a document clears the history. */
export function useAutoHistory() {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: emptyDocument(), future: [], lastKey: null, lastAt: 0 }));

  const change = useCallback((update: (document: AutoDocument) => AutoDocument, key?: string) => {
    setHistory(current => {
      const next = update(current.present);
      if (next === current.present) return current;
      const now = Date.now();
      const merge = key !== undefined && key === current.lastKey && now - current.lastAt < coalesceMilliseconds;
      return {
        past: merge ? current.past : [...current.past, current.present].slice(-maxUndoSteps),
        present: next,
        future: [],
        lastKey: key ?? null,
        lastAt: now
      };
    });
  }, []);

  const reset = useCallback((document: AutoDocument) => {
    setHistory({ past: [], present: document, future: [], lastKey: null, lastAt: 0 });
  }, []);

  const undo = useCallback(() => setHistory(current => current.past.length === 0 ? current : {
    past: current.past.slice(0, -1), present: current.past[current.past.length - 1],
    future: [current.present, ...current.future], lastKey: null, lastAt: 0
  }), []);

  const redo = useCallback(() => setHistory(current => current.future.length === 0 ? current : {
    past: [...current.past, current.present], present: current.future[0],
    future: current.future.slice(1), lastKey: null, lastAt: 0
  }), []);

  return { document: history.present, change, reset, undo, redo,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
