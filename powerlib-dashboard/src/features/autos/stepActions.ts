// Editing the selected auto's steps: add, insert, delete, reorder, limits, align, copy.
import type { AutoRoutine, AutoStep, AutoStepType, InsertTarget, LegConstraints, ListRef } from "./autoModel";
import { createStep, filterSteps, insertStepsAt, moveStepsInto, outermostSteps, shiftSteps } from "./autoModel";
import { alignAnchor, alignIn, applyLimitsIn, cloneStep, newDriveStep, patchStepIn, updateAutoIn } from "./autoEdits";
import { insertTargetAfter } from "./autoRoute";
import type { EditorContext } from "./editorContext";
import type { FieldPoint } from "./types";

export function stepActions(ctx: EditorContext) {
  const { auto, change, selection, setSelection, choices, project } = ctx;
  const steps = auto?.steps ?? [];

  // `key` merges rapid edits of the same thing (a drag, typing in one field) into one undo step.
  const updateAuto = (id: string, update: (auto: AutoRoutine) => AutoRoutine, key?: string) =>
    change(current => updateAutoIn(current, id, update), key);
  const updateSelected = (update: (auto: AutoRoutine) => AutoRoutine, key?: string) => { if (auto) updateAuto(auto.id, update, key); };
  const updateStep = (stepId: string, patch: Partial<AutoStep>, key = `step:${stepId}:${Object.keys(patch).sort().join(",")}`) =>
    updateSelected(current => ({ ...current, steps: patchStepIn(current.steps, stepId, patch) }), key);
  const updateSteps = (update: (steps: AutoStep[]) => AutoStep[], key?: string) =>
    updateSelected(current => {
      const next = update(current.steps);
      return next === current.steps ? current : { ...current, steps: next };
    }, key);

  /** New steps go after the selected step (the last one, in run order) so an auto is built in order. */
  const defaultTarget = () => insertTargetAfter(steps, selection);
  const insertSteps = (added: AutoStep[], target = defaultTarget()) => {
    if (!added.length) return;
    updateSteps(current => insertStepsAt(current, target, added));
    setSelection(added.map(step => step.id));
  };
  /** A drive step where new steps go, starting from the previous leg's pose and limits; `at` moves it. */
  const newDrive = (target: InsertTarget, at?: FieldPoint) => newDriveStep(steps, choices, target, project, at);
  const deleteSteps = (stepIds: string[]) => {
    updateSteps(current => filterSteps(current, step => !stepIds.includes(step.id)));
    setSelection(current => current.filter(id => !stepIds.includes(id)));
  };
  /** The selected steps to copy or duplicate; a selected branch carries the steps inside it. */
  const stepsToCopy = (stepIds: string[]) => outermostSteps(steps, stepIds);
  const applyLimits = (stepIds: string[] | null, limits: Partial<LegConstraints>) =>
    updateSteps(current => applyLimitsIn(current, stepIds, limits), `limits:${stepIds?.join(",") ?? "all"}:${Object.keys(limits).join(",")}`);

  return {
    updateAuto,
    updateSelected,
    updateStep,
    defaultTarget,
    insertSteps,
    newDrive,
    stepsToCopy,
    applyLimits,
    deleteSteps,
    addStep: (type: AutoStepType, target = defaultTarget()) =>
      insertSteps([type === "drive" ? newDrive(target) : createStep(type, project)], target),
    duplicateSteps: (stepIds: string[]) => insertSteps(stepsToCopy(stepIds).map(cloneStep)),
    pasteSteps: (copied: AutoStep[]) => insertSteps(copied.map(cloneStep)),
    /** Moves the steps one place earlier or later in their list together, keeping their order; blocked at the ends. */
    moveSteps: (stepIds: string[], offset: -1 | 1) => updateSteps(current => shiftSteps(current, stepIds, offset)),
    /** Drops the steps (kept in their order) before the step now at `index` of `list`. */
    moveStepsTo: (stepIds: string[], list: ListRef, index: number) => updateSteps(current => moveStepsInto(current, stepIds, list, index)),
    applyLimitsToAll: (limits: LegConstraints) => {
      applyLimits(null, limits);
      ctx.notify({ severity: "success", text: "Applied these limits to every drive step in this auto." });
    },
    /** Lines up the selected drive points with the primary (last selected) one. */
    alignSelected: (axis: "x" | "y") => {
      const anchor = alignAnchor(steps, selection, ctx.selectedStepId);
      if (anchor) updateSteps(current => alignIn(current, selection, anchor, axis));
    }
  };
}

export type StepActions = ReturnType<typeof stepActions>;
