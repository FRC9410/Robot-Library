import { useCallback, useEffect, useState } from "react";
import type { AutoDocument } from "./autoModel";
import { locateStep } from "./autoModel";
import type { SelectMode } from "./types";

/** The selection after clicking `ids`: replace it, add them (keeping click order), or toggle each. */
const nextSelection = (current: string[], ids: string[], mode: SelectMode) =>
  mode === "replace" ? ids
    : mode === "add" ? [...current.filter(id => !ids.includes(id)), ...ids]
      : ids.reduce((next, id) => next.includes(id) ? next.filter(other => other !== id) : [...next, id], current);

/**
 * The auto being edited and the selected steps, in click order; the last selected step is the
 * primary one the inspector shows.
 */
export function useAutoSelection(document: AutoDocument) {
  const [selectedAutoId, setSelectedAutoId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const selectedStepId = selection.length ? selection[selection.length - 1] : null;
  const auto = document.autos.find(candidate => candidate.id === selectedAutoId) ?? null;

  const selectStep = useCallback((id: string | null) => setSelection(id ? [id] : []), []);
  const selectSteps = useCallback((ids: string[], mode: SelectMode) => setSelection(current => nextSelection(current, ids, mode)), []);
  /** After loading, keeps the auto picked if it still exists, else picks the first. */
  const keepAutoIn = useCallback((next: AutoDocument) => {
    setSelectedAutoId(current => next.autos.some(candidate => candidate.id === current) ? current : next.autos[0]?.id ?? null);
    setSelection([]);
  }, []);

  // Undo and redo can remove the selected auto or step; fall back to something that exists.
  useEffect(() => {
    if (selectedAutoId !== null && !document.autos.some(candidate => candidate.id === selectedAutoId)) {
      setSelectedAutoId(document.autos[0]?.id ?? null);
      selectStep(null);
    } else if (selection.some(id => !auto || !locateStep(auto.steps, id))) {
      setSelection(current => current.filter(id => auto && locateStep(auto.steps, id)));
    }
  }, [document, selectedAutoId, selection, auto, selectStep]);

  return { auto, selectedAutoId, setSelectedAutoId, selection, setSelection, selectedStepId, selectStep, selectSteps, keepAutoIn };
}
