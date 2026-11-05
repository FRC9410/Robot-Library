import { useRef, useState } from "react";
import type { DragEvent } from "react";
import type { AutoStep, ListRef } from "./autoModel";
import { allSteps } from "./autoModel";
import { listKey } from "./stepListRows";

/** Where dragged steps would land: before the step now at `index` of `list` (its length for the end). */
export type StepDrop = { list: ListRef; index: number };

/**
 * Drag-and-drop reordering for the step list. Dragging a selected step carries the whole selection;
 * the drop line shows where it lands. Branches can't go inside a branch.
 */
export function useStepDrag(steps: AutoStep[], selectedStepIds: string[], onReorder: (stepIds: string[], list: ListRef, index: number) => void) {
  const dragging = useRef<{ ids: string[]; branch: boolean } | null>(null);
  const [drop, setDrop] = useState<StepDrop | null>(null);

  const isDrop = (list: ListRef, index: number) => drop !== null && listKey(drop.list) === listKey(list) && drop.index === index;
  const end = () => { dragging.current = null; setDrop(null); };

  /** Shows where a drop would land, when the dragged steps can go there. */
  const offer = (event: DragEvent, list: ListRef, index: number) => {
    if (!dragging.current) return;
    if (list && dragging.current.branch) { setDrop(null); return; }
    event.preventDefault();
    if (!isDrop(list, index)) setDrop({ list, index });
  };

  const start = (event: DragEvent, stepId: string) => {
    const ids = selectedStepIds.includes(stepId) ? selectedStepIds : [stepId];
    dragging.current = { ids, branch: allSteps(steps).some(candidate => candidate.type === "branch" && ids.includes(candidate.id)) };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ids.join(","));
  };

  const listHandlers = {
    onDragLeave: (event: DragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrop(null); },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (dragging.current && drop) onReorder(dragging.current.ids, drop.list, drop.index);
      end();
    }
  };

  return { isDrop, offer, start, end, listHandlers };
}
