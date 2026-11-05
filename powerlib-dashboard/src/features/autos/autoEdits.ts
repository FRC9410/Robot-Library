// Pure edits to the auto document, used by the Auto Builder's editing hooks.
import type {
  AutoDocument, AutoProject, AutoRoutine, AutoStep, BranchChoices, BranchCondition, BranchStep, DriveStep, InsertTarget, LegConstraints, LegTurn,
  NamedPoint, Symmetry
} from "./autoModel";
import { allSteps, branchWaitSeconds, createId, createStep, flipPoint, legConstraints, mapSteps, normalizeHeading, round, syncNamedPoints } from "./autoModel";
import { driveBefore, isDrive } from "./autoRoute";
import type { FieldPoint, FieldSize, PointChange } from "./types";

/** A copy with new ids, so pasted and duplicated steps never share subpoints or branch sides with the original. */
export function cloneStep(step: AutoStep): AutoStep {
  return step.type === "drive"
    ? { ...step, id: createId(), subpoints: step.subpoints.map(subpoint => ({ ...subpoint, id: createId() })) }
    : step.type === "branch" ? { ...step, id: createId(), then: step.then.map(cloneStep), otherwise: step.otherwise.map(cloneStep) }
      : { ...step, id: createId() };
}

/** "Auto N", counting up from the number of autos until the name is free. */
export function nextAutoName(autos: AutoRoutine[]) {
  const names = new Set(autos.map(auto => auto.name));
  let number = autos.length + 1;
  while (names.has(`Auto ${number}`)) number++;
  return `Auto ${number}`;
}

/** A new leg starts from the previous leg's pose and limits, so long autos need few edits. */
export function newDriveStep(steps: AutoStep[], choices: BranchChoices, target: InsertTarget,
  project: Pick<AutoProject, "states" | "field">, at?: FieldPoint): DriveStep {
  const previous = driveBefore(steps, choices, target);
  const base = createStep("drive", project) as DriveStep;
  return { ...base, ...(previous ? { x: previous.x, y: previous.y, heading: previous.heading, ...legConstraints(previous) } : {}),
    ...(at ? { x: at.x, y: at.y } : {}) };
}

/** Replaces one auto, keeping named points in step with the auto's linked steps. */
export const updateAutoIn = (document: AutoDocument, id: string, update: (auto: AutoRoutine) => AutoRoutine): AutoDocument =>
  syncNamedPoints({ ...document, autos: document.autos.map(auto => auto.id === id ? update(auto) : auto) }, id);

export const patchStepIn = (steps: AutoStep[], stepId: string, patch: Partial<AutoStep>) =>
  mapSteps(steps, step => step.id === stepId ? { ...step, ...patch } as AutoStep : step);

/** The auto with new ids, placed right after the original; its branches are paired with the original's by order. */
export function duplicateAuto(source: AutoRoutine) {
  const copy: AutoRoutine = { ...source, id: createId(), name: `${source.name} copy`, isDefault: false, steps: source.steps.map(cloneStep) };
  const branchIds = (steps: AutoStep[]) => allSteps(steps).filter((step): step is BranchStep => step.type === "branch").map(step => step.id);
  const sourceBranches = branchIds(source.steps);
  return { copy, branchPairs: branchIds(copy.steps).map((copyId, index) => [sourceBranches[index], copyId] as const) };
}

export function insertAutoAfter(document: AutoDocument, afterId: string, auto: AutoRoutine): AutoDocument {
  const autos = [...document.autos];
  autos.splice(autos.findIndex(candidate => candidate.id === afterId) + 1, 0, auto);
  return { ...document, autos };
}

/** Making one auto the default clears it on the rest. */
export const setDefaultIn = (document: AutoDocument, id: string, checked: boolean): AutoDocument => ({ ...document,
  autos: document.autos.map(auto => ({ ...auto, isDefault: auto.id === id ? checked : checked ? false : auto.isDefault })) });

/** Applies limits to the drive steps with these ids, or every drive step when `stepIds` is null. */
export const applyLimitsIn = (steps: AutoStep[], stepIds: string[] | null, limits: Partial<LegConstraints>) =>
  mapSteps(steps, step => step.type === "drive" && (stepIds === null || stepIds.includes(step.id)) ? { ...step, ...limits } : step);

/** The drive point the others line up with: the primary step, else the last selected drive in run order. */
export function alignAnchor(steps: AutoStep[], selection: string[], primaryId: string | null) {
  const drives = allSteps(steps).filter(isDrive);
  return drives.find(step => step.id === primaryId) ?? [...drives].reverse().find(step => selection.includes(step.id));
}

export const alignIn = (steps: AutoStep[], selection: string[], anchor: DriveStep, axis: "x" | "y") =>
  mapSteps(steps, step => step.type === "drive" && selection.includes(step.id) ? { ...step, [axis]: anchor[axis] } : step);

/** Moves the selected drive points (as shown on the field), or turns them when `turn` is not zero. */
export function nudgeChanges(shownSteps: AutoStep[], selection: string[], dx: number, dy: number, turn: number, field: FieldSize): PointChange[] {
  const clamp = (value: number, max: number) => round(Math.min(Math.max(value, 0), max));
  return allSteps(shownSteps).filter((step): step is DriveStep => step.type === "drive" && selection.includes(step.id))
    .map(step => turn !== 0
      ? { stepId: step.id, heading: normalizeHeading(Math.round(step.heading + turn)) }
      : { stepId: step.id, x: clamp(step.x + dx, field.length), y: clamp(step.y + dy, field.width) });
}

/** Turns field edits made on the shown auto into poses for the original, flipping them back from the mirrored copy. */
export function pointPatches(changes: PointChange[], shownSteps: AutoStep[], flips: Symmetry | null, field: FieldSize) {
  return new Map(changes.map(change => {
    const shown = allSteps(shownSteps).find((step): step is DriveStep => step.id === change.stepId && step.type === "drive");
    if (!shown) return [change.stepId, null] as const;
    const next = { x: change.x ?? shown.x, y: change.y ?? shown.y, heading: change.heading ?? shown.heading };
    return [change.stepId, flips ? flipPoint(next, flips, field) : next] as const;
  }));
}

export const applyPointPatches = (steps: AutoStep[], patches: ReturnType<typeof pointPatches>) => mapSteps(steps, step => {
  const patch = patches.get(step.id);
  return patch && step.type === "drive" ? { ...step, x: patch.x, y: patch.y, heading: patch.heading } : step;
});

export const subpointProgressIn = (steps: AutoStep[], stepId: string, subpointId: string, progress: number) =>
  mapSteps(steps, step => step.id === stepId && step.type === "drive"
    ? { ...step, subpoints: step.subpoints.map(subpoint => subpoint.id === subpointId ? { ...subpoint, progress } : subpoint) }
    : step);

/** Links the drive step with this id, in whichever auto has it, to a named point; `setNamedPoint` then adds the point. */
export const linkStepToPoint = (document: AutoDocument, stepId: string, point: NamedPoint): AutoDocument => ({ ...document,
  autos: document.autos.map(auto => ({ ...auto,
    steps: mapSteps(auto.steps, step => step.id === stepId ? { ...step, pointId: point.id } as AutoStep : step) })) });

export const renamePointIn = (document: AutoDocument, pointId: string, name: string): AutoDocument =>
  ({ ...document, points: document.points.map(point => point.id === pointId ? { ...point, name } : point) });

/** How many drive steps, across every auto, drive to or face a named point. */
export const pointUses = (autos: AutoRoutine[], pointId: string) => autos.reduce((count, auto) => count + allSteps(auto.steps)
  .filter(step => step.type === "drive" && (step.pointId === pointId || (step.turn.mode === "face" && step.turn.pointId === pointId))).length, 0);

/** The leg's turn in a new mode; Face point starts two meters ahead of the robot, along its heading. */
export function turnWithMode(step: DriveStep, mode: LegTurn["mode"]): LegTurn {
  if (mode === "now") return { mode: "now" };
  if (mode === "later") return { mode: "later", startProgress: 0.5 };
  const radians = step.heading * Math.PI / 180;
  return { mode: "face", x: round(step.x + 2 * Math.cos(radians)), y: round(step.y + 2 * Math.sin(radians)), pointId: null };
}

/** A branch condition of a new kind, keeping how long it waits; the first state or check is picked. */
export function conditionWithKind(step: BranchStep, kind: BranchCondition["kind"], states: string[], checks: string[]): BranchCondition {
  const wait = branchWaitSeconds(step);
  return kind === "state" ? { kind, state: states[0] ?? "", waitSeconds: wait }
    : kind === "check" ? { kind, method: checks[0] ?? "", waitSeconds: wait } : { kind, seconds: 5 };
}
