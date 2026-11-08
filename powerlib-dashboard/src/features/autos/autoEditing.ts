import { allSteps, createId, flipSteps, mapSteps, normalizeHeading, round, setNamedPoint, type AutoDocument, type AutoRoutine, type AutoStep, type DriveStep, type Symmetry } from "./autoModel";

export type FieldSize = { length: number; width: number };
/** Move selected rows to the boundary before a row, or to the end with null. */
export function reorderStepsBefore(steps: AutoStep[], ids: string[], before: string | null): AutoStep[] {
  const boundary = before === null ? steps.length : steps.findIndex(step => step.id === before);
  if (boundary < 0 || !steps.some(step => ids.includes(step.id))) return steps;
  const moved = steps.filter(step => ids.includes(step.id)), remaining = steps.filter(step => !ids.includes(step.id));
  const index = steps.slice(0, boundary).filter(step => !ids.includes(step.id)).length;
  return [...remaining.slice(0, index), ...moved, ...remaining.slice(index)];
}
/** A standalone routine: new identities, reflected poses, and no links back to the source. */
export function duplicateAuto(auto: AutoRoutine, name: string, reflection: Symmetry, field: FieldSize): AutoRoutine {
  return { ...structuredClone(auto), id: createId(), name, isDefault: false, clearRequestsAtEnd: true,
    alliance: reflection.flipX ? auto.alliance === "Blue" ? "Red" : auto.alliance === "Red" ? "Blue" : null : auto.alliance,
    symmetry: { flipX: false, flipY: false }, steps: flipSteps(auto.steps, reflection, field).map(cloneStep) };
}
export function uniqueAutoCopyName(auto: AutoRoutine, names: string[]): string {
  const used = new Set(names.map(name => name.trim()));
  for (let number = 1; ; number++) {
    const suffix = number === 1 ? " copy" : ` copy ${number}`;
    const name = auto.name.trim().slice(0, 100 - suffix.length) + suffix;
    if (!used.has(name)) return name;
  }
}
export function cloneStep(step: AutoStep): AutoStep {
  if (step.type === "drive") return { ...structuredClone(step), id: createId(), subpoints: step.subpoints.map(subpoint => ({ ...subpoint, id: createId() })) };
  if (step.type === "branch") return { ...structuredClone(step), id: createId(), then: step.then.map(cloneStep), otherwise: step.otherwise.map(cloneStep) };
  return { ...structuredClone(step), id: createId() };
}
export const shownAuto = (auto: AutoRoutine, mirror: Symmetry | null, field: FieldSize): AutoRoutine =>
  mirror ? { ...auto, steps: flipSteps(auto.steps, mirror, field).map((step, index) => step.type === "drive" && auto.steps[index].type === "drive" ? { ...step, pointId: (auto.steps[index] as DriveStep).pointId } : step) } : auto;

export function editAuto(document: AutoDocument, autoId: string, update: (auto: AutoRoutine) => AutoRoutine) {
  const original = document.autos.find(auto => auto.id === autoId);
  if (!original) return document;
  const changed = update(original);
  let next = { ...document, autos: document.autos.map(auto => auto.id === autoId ? changed : auto) };
  const updated = new Set<string>();
  for (const step of allSteps(changed.steps)) {
    if (step.type !== "drive" || !step.pointId || updated.has(step.pointId)) continue;
    const before = allSteps(original.steps).find(candidate => candidate.id === step.id);
    if (before?.type === "drive" && before.x === step.x && before.y === step.y && before.heading === step.heading) continue;
    const point = next.points.find(point => point.id === step.pointId);
    if (point) { next = setNamedPoint(next, { ...point, x: step.x, y: step.y, heading: step.heading }); updated.add(point.id); }
  }
  return next;
}

/** Inverse mirroring is the same reflection; keep the original named-point link. */
export function sourceStep(step: AutoStep, original: AutoStep, mirror: Symmetry | null, field: FieldSize): AutoStep {
  if (!mirror || step.type !== "drive" || original.type !== "drive") return step;
  const flipped = flipSteps([step], mirror, field)[0] as DriveStep;
  return { ...flipped, pointId: original.pointId };
}

/** Translate a group without distorting its spacing at the field boundary. */
export function translateSteps(steps: AutoStep[], ids: string[], dx: number, dy: number, field: FieldSize): AutoStep[] {
  const drives = allSteps(steps).filter((step): step is DriveStep => step.type === "drive" && ids.includes(step.id));
  if (!drives.length) return steps;
  const clampDelta = (values: number[], delta: number, max: number) => {
    const low = -Math.min(...values), high = max - Math.max(...values);
    return low > high ? 0 : Math.max(low, Math.min(high, delta));
  };
  const x = clampDelta(drives.map(step => step.x), dx, field.length), y = clampDelta(drives.map(step => step.y), dy, field.width);
  return mapSteps(steps, step => step.type === "drive" && ids.includes(step.id) ? { ...step, x: round(step.x + x, 4), y: round(step.y + y, 4) } : step);
}
export const turnSteps = (steps: AutoStep[], ids: string[], degrees: number) => mapSteps(steps,
  step => step.type === "drive" && ids.includes(step.id) ? { ...step, heading: normalizeHeading(round(step.heading + degrees, 4)) } : step);
