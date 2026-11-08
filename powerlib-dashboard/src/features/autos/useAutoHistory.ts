import { useCallback, useRef, useState } from "react";
import type { AutoDocument } from "./autoModel";
import { AutoHistory } from "./autoHistory";

export function useAutoHistory(initial: () => AutoDocument) {
  const history = useRef<AutoHistory | null>(null);
  history.current ??= new AutoHistory(initial());
  const [, render] = useState(0);
  const change = useCallback((action: (history: AutoHistory) => void) => { action(history.current!); render(value => value + 1); }, []);
  const setDocument = useCallback((update: AutoDocument | ((document: AutoDocument) => AutoDocument)) => change(history => history.update(update)), [change]);
  const reset = useCallback((document: AutoDocument) => change(history => history.reset(document)), [change]);
  return { document: history.current.document, setDocument, reset,
    undo: () => change(history => history.undo()), redo: () => change(history => history.redo()),
    beginGesture: () => change(history => history.begin()), endGesture: (cancel = false) => change(history => history.end(cancel)),
    canUndo: history.current.canUndo, canRedo: history.current.canRedo, gesturing: history.current.gesturing };
}
