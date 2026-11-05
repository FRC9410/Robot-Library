import { useEffect, useRef } from "react";
import type { AutoRoutine, AutoStep } from "./autoModel";
import { allSteps } from "./autoModel";
import type { KeyAction } from "./autoKeys";
import { keyAction, neighborIndex } from "./autoKeys";
import { stepsInOrder } from "./autoRoute";
import type { FieldActions } from "./fieldActions";
import type { StepActions } from "./stepActions";
import type { Notify } from "./types";

export type ShortcutTargets = {
  auto: AutoRoutine | null;
  selection: string[];
  selectedStepId: string | null;
  setSelection: (stepIds: string[]) => void;
  steps: StepActions;
  field: FieldActions;
  save: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  openHelp: () => void;
  playPause: () => void;
  notify: Notify;
};

/** Menus, dropdowns and dialogs own the keyboard while they are open. */
const overlayOpen = (target: Element | null) =>
  Boolean(target?.closest("[role='menu'], [role='listbox'], [role='dialog']") || document.querySelector("[role='menu'], [role='listbox'], [role='dialog']"));

/** The Auto Builder's keyboard shortcuts (listed for the help dialog in autoShortcuts.ts). */
export function useAutoShortcuts(targets: ShortcutTargets) {
  const clipboard = useRef<AutoStep[]>([]);

  useEffect(() => {
    const { auto, selection, steps } = targets;
    const ordered = allSteps(auto?.steps ?? []);
    const selected = stepsInOrder(auto?.steps ?? [], selection);
    const run = (action: KeyAction) => {
      switch (action.kind) {
        case "save": void targets.save(); break;
        case "undo": targets.undo(); break;
        case "redo": targets.redo(); break;
        case "help": targets.openHelp(); break;
        case "playPause": targets.playPause(); break;
        case "selectAll": targets.setSelection(ordered.map(step => step.id)); break;
        case "addStep": steps.addStep(action.type); break;
        case "selectNeighbor":
          targets.setSelection([ordered[neighborIndex(ordered.length, ordered.findIndex(step => step.id === targets.selectedStepId), action.offset)].id]);
          break;
        case "paste": steps.pasteSteps(clipboard.current); break;
        case "copy":
          clipboard.current = steps.stepsToCopy(selection);
          targets.notify({ severity: "info", text: `Copied ${selected.length === 1 ? "the step" : `${selected.length} steps`}. Press Ctrl+V to paste after the selected step.` });
          break;
        case "duplicate": steps.duplicateSteps(selection); break;
        case "delete": steps.deleteSteps(selection); break;
        case "clearSelection": targets.setSelection([]); break;
        case "moveSteps": steps.moveSteps(selection, action.offset); break;
        case "nudge": targets.field.nudgeSelected(action.dx, action.dy, 0); break;
        case "turn": targets.field.nudgeSelected(0, 0, action.degrees); break;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (overlayOpen(target)) return;
      const action = keyAction(event, {
        typing: Boolean(target?.closest("input, textarea, select, [contenteditable='true']")),
        hasAuto: auto !== null,
        hasSteps: ordered.length > 0,
        hasClipboard: clipboard.current.length > 0,
        hasSelection: selected.length > 0,
        selectionHasDrive: selected.some(step => step.type === "drive")
      });
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      run(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}
