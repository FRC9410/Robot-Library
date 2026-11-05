import { useCallback, useEffect, useRef, useState } from "react";
import { setPendingAutoSave } from "./autoCode";
import type { AutoDocument } from "./autoModel";
import { emptyDocument } from "./autoModel";
import type { Notify, SaveState } from "./types";

/** Edits save on their own after this pause; File → Update Code writes them into robot code. */
const autosaveMilliseconds = 500;

/**
 * Saves the autos a moment after each edit, right away on Ctrl+S or Update Code, and when the tab
 * closes with an edit still waiting.
 */
export function useAutoSave(api: Window["powerlib"], document: AutoDocument, loading: boolean, notify: Notify) {
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(emptyDocument()));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const dirty = JSON.stringify(document) !== savedJson;

  const persist = useCallback(async (next: AutoDocument) => {
    if (!api) return;
    setSaveState("saving");
    try {
      await api.saveAutos(next);
      setSavedJson(JSON.stringify(next));
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      notify({ severity: "error", text: error instanceof Error ? error.message : "Could not save autos." });
    }
  }, [api, notify]);

  const flushRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (!api || !dirty || loading) { flushRef.current = null; setPendingAutoSave(null); return; }
    const timer = window.setTimeout(() => { flushRef.current = null; setPendingAutoSave(null); void persist(document); }, autosaveMilliseconds);
    const flush = () => { window.clearTimeout(timer); flushRef.current = null; setPendingAutoSave(null); return persist(document); };
    flushRef.current = flush;
    setPendingAutoSave(flush);
    return () => window.clearTimeout(timer);
  }, [api, dirty, document, loading, persist]);
  // Leaving the tab saves anything still waiting.
  useEffect(() => () => { void flushRef.current?.(); }, []);

  const save = useCallback(async () => { await flushRef.current?.(); }, []);
  /** Marks a freshly loaded document as saved. */
  const markSaved = useCallback((next: AutoDocument) => setSavedJson(JSON.stringify(next)), []);
  return { saveState, dirty, save, markSaved };
}
