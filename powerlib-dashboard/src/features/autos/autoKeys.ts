// What each Auto Builder key press does. autoShortcuts.ts lists the same keys for the help dialog.
import type { AutoStepType } from "./autoModel";

export type KeyAction =
  | { kind: "save" | "undo" | "redo" | "help" | "playPause" | "selectAll" | "paste" | "copy" | "duplicate" | "delete" | "clearSelection" }
  | { kind: "addStep"; type: AutoStepType }
  | { kind: "selectNeighbor"; offset: -1 | 1 }
  | { kind: "moveSteps"; offset: -1 | 1 }
  | { kind: "nudge"; dx: number; dy: number }
  | { kind: "turn"; degrees: number };

export type KeyPress = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };

/** What the editor has right now, which decides whether a key does anything. */
export type KeyContext = {
  /** Focus is in a text field, where undo, redo and the editing keys belong to the field. */
  typing: boolean;
  hasAuto: boolean;
  hasSteps: boolean;
  hasClipboard: boolean;
  /** Steps of this auto are selected; and whether any of them is a drive. */
  hasSelection: boolean;
  selectionHasDrive: boolean;
};

const numberedSteps: AutoStepType[] = ["drive", "requestState", "waitForState", "wait", "branch"];

/** The action for a key press, or null when the key isn't a shortcut here. */
export function keyAction(press: KeyPress, context: KeyContext): KeyAction | null {
  const control = press.ctrlKey || press.metaKey;
  const key = press.key.toLowerCase();
  if (control && key === "s") return { kind: "save" };
  if (context.typing) return null;
  if (control && key === "z" && !press.shiftKey) return { kind: "undo" };
  if (control && (key === "y" || (key === "z" && press.shiftKey))) return { kind: "redo" };
  if (press.key === "?") return { kind: "help" };
  if (press.key === " " && !control) return { kind: "playPause" };
  if (!context.hasAuto || (press.altKey && key !== "arrowup" && key !== "arrowdown")) return null;

  if (control && key === "a") return { kind: "selectAll" };
  if (!control && !press.altKey && /^[1-5]$/.test(press.key)) return { kind: "addStep", type: numberedSteps[Number(press.key) - 1] };
  if (!control && (press.key === "[" || press.key === "]") && context.hasSteps) return { kind: "selectNeighbor", offset: press.key === "]" ? 1 : -1 };
  if (control && key === "v" && context.hasClipboard) return { kind: "paste" };
  if (!context.hasSelection) return null;
  if (control && key === "c") return { kind: "copy" };
  if (control && key === "d") return { kind: "duplicate" };
  if (press.key === "Delete" || press.key === "Backspace") return { kind: "delete" };
  if (press.key === "Escape") return { kind: "clearSelection" };
  if (press.altKey && (key === "arrowup" || key === "arrowdown")) return { kind: "moveSteps", offset: key === "arrowup" ? -1 : 1 };
  if (!control && key.startsWith("arrow") && context.selectionHasDrive) {
    const distance = press.shiftKey ? 0.25 : 0.05;
    return { kind: "nudge", dx: key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0,
      dy: key === "arrowdown" ? -distance : key === "arrowup" ? distance : 0 };
  }
  if (!control && (key === "q" || key === "e") && context.selectionHasDrive) {
    return { kind: "turn", degrees: (press.shiftKey ? 1 : 15) * (key === "q" ? 1 : -1) };
  }
  return null;
}

/** The step to select with [ or ]: the next or previous one, or an end when nothing is selected. */
export function neighborIndex(count: number, index: number, offset: -1 | 1) {
  return index < 0 ? (offset === 1 ? 0 : count - 1) : Math.min(count - 1, Math.max(0, index + offset));
}
