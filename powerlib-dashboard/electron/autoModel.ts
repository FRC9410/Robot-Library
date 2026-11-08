// Auto Builder model. Every step maps to one frc.powerlib.auto.Auto call; drive legs use the
// robot's DriveToPose command with that leg's DriveConstraints.

export type Alliance = "Blue" | "Red";

/** Matches frc.powerlib.auto.DriveConstraints; a leg finishes inside both end tolerances. */
export type LegConstraints = {
  maxVelocity: number;
  maxAcceleration: number;
  endDistanceTolerance: number;
  endVelocityTolerance: number;
};

/**
 * A state request made partway through a drive leg: once the robot is `progress` (0 to 1) of the
 * way along the leg, or when the leg finishes if that comes first. Matches DriveToPose.atProgress.
 */
export type Subpoint = { id: string; progress: number; state: string };

/**
 * How a leg turns (frc.powerlib.auto.LegHeading): toward its heading right away, only once the leg
 * is `startProgress` (0 to 1) done, or facing a field point (such as a goal) the whole time.
 */
export type LegTurn =
  | { mode: "now" }
  | { mode: "later"; startProgress: number }
  | { mode: "face"; x: number; y: number; pointId: string | null };

/**
 * `pointId` links the pose to a named point; moving either moves both. `maxTurnRate` is in degrees
 * per second; null uses the robot's drive-to-point rate.
 */
export type DriveStep = { id: string; type: "drive"; x: number; y: number; heading: number; subpoints: Subpoint[];
  turn: LegTurn; maxTurnRate: number | null; pointId: string | null;
  /** Degrees; null finishes on position and speed only. */
  endHeadingTolerance: number | null;
  /** Optional actions after arrival, before continuing to the next step. */
  executeState: string | null; waitForState: string | null;
  /** Legacy storage field; state waits no longer time out and parsing resets this to null. */
  stateTimeoutSeconds: number | null } & LegConstraints;

/** A pose saved once and reused across autos, such as a shooting spot. */
export type NamedPoint = { id: string; name: string; x: number; y: number; heading: number };
export type RequestStateStep = { id: string; type: "requestState"; state: string };
/** replaySeconds only paces the replay; the robot waits for the real state. */
export type WaitForStateStep = { id: string; type: "waitForState"; state: string; timeoutSeconds: number | null; replaySeconds: number };
export type WaitStep = { id: string; type: "wait"; seconds: number };

/**
 * What a branch checks when the robot reaches it: the actual state, a yes/no method on
 * StateMachine (such as hasFuel()), or the time left in the autonomous period. State and method
 * checks can first wait up to `waitSeconds` for the answer to become yes.
 */
export type BranchCondition =
  | { kind: "state"; state: string; waitSeconds: number }
  | { kind: "check"; method: string; waitSeconds: number }
  | { kind: "timeLeft"; seconds: number };
export type BranchArm = "then" | "otherwise";
/** Runs `then` when the condition holds and `otherwise` when it doesn't; the auto carries on after either. Branches don't nest. */
export type BranchStep = { id: string; type: "branch"; condition: BranchCondition; then: AutoStep[]; otherwise: AutoStep[] };
export type AutoStep = DriveStep | RequestStateStep | WaitForStateStep | WaitStep | BranchStep;
export type AutoStepType = AutoStep["type"];
/** A list of steps: the auto's own (null) or one side of a branch. */
export type ListRef = { branchId: string; arm: BranchArm } | null;
/** Which side of each branch the field and replay follow, by branch id; Then when missing. */
export type BranchChoices = Record<string, BranchArm>;

/** Flips that produce the auto's mirrored copy for the other side of the field. */
export type Symmetry = { flipX: boolean; flipY: boolean };

export type AutoRoutine = {
  id: string;
  name: string;
  alliance: Alliance | null;
  /** Legacy storage fields: generated routines are never defaults and always clear their owner. */
  isDefault: boolean;
  clearRequestsAtEnd: boolean;
  symmetry: Symmetry;
  steps: AutoStep[];
};

/**
 * A Limelight on the robot, for the tag-visibility view. `x`, `y` and `z` are the lens in robot
 * coordinates (x forward, y left, z up from the carpet); `yaw` is degrees left of straight ahead and
 * `pitch` degrees above level, the same frame as the Limelight's own robot-space camera pose.
 */
export type CameraMount = {
  id: string;
  name: string;
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  /** Field of view in degrees and the detector's image width in pixels. */
  hFov: number; vFov: number;
  imageWidth: number;
  enabled: boolean;
};

/** `periodSeconds` is the autonomous period the replay timeline marks (20 s in 2026 REBUILT). */
/**
 * The powerlib-autos.json format version. Keep in step with autosFileVersion in electron/autoFiles.ts,
 * which refuses to write over a file with a higher number. Raise both when older copies would lose
 * something by reading and saving the file, such as a new step type; new fields older copies can
 * ignore don't need it, since parseAutoDocument keeps fields it doesn't know. Changes to execution
 * semantics also need a version bump so older generators cannot silently omit them.
 */
export const autosFileVersion = 4;

export type AutoDocument = { version: typeof autosFileVersion; periodSeconds: number; points: NamedPoint[]; cameras: CameraMount[]; autos: AutoRoutine[] };
export const defaultPeriodSeconds = 20;

/** A new camera, pointed straight ahead. The field of view matches a Limelight 3G or 4 (80° × 56°). */
export const newCamera = (name: string): CameraMount =>
  ({ id: createId(), name, x: 0.25, y: 0, z: 0.35, yaw: 0, pitch: 15, hFov: 80, vFov: 56, imageWidth: 1280, enabled: true });

/** What the builder knows about the robot project it generates for. */
export type AutoProject = {
  states: string[];
  /** Whether DriveToPose and DriveConstraints exist in the project; null when unknown. */
  driveCommandInstalled: boolean | null;
  field: { length: number; width: number };
  /** String literals in RobotAutos.java, which include the names of hand-written autos. */
  handWrittenNames?: string[];
  /** StateMachine's public boolean methods with no arguments, which branches can check; undefined when unknown. */
  checks?: string[];
};

export type AutoIssue = { autoId: string; stepId?: string; severity: "error" | "warning"; message: string };

export const stepLabels: Record<AutoStepType, string> = {
  drive: "Drive to point",
  requestState: "Execute state",
  waitForState: "Wait for state",
  wait: "Wait",
  branch: "Branch"
};

/** Same values as DriveConstraints.DEFAULT on the robot. */
export const defaultConstraints: LegConstraints = { maxVelocity: 3, maxAcceleration: 3, endDistanceTolerance: 0.05, endVelocityTolerance: 0.1 };
export const constraintKeys = Object.keys(defaultConstraints) as (keyof LegConstraints)[];
export const noSymmetry: Symmetry = { flipX: false, flipY: false };

export const emptyDocument = (): AutoDocument => ({ version: autosFileVersion, periodSeconds: defaultPeriodSeconds, points: [], cameras: [], autos: [] });
/** The robot's default drive-to-point turn rate (π rad/s), used when a leg has no limit of its own. */
export const defaultTurnRate = 180;

export function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createAuto(name: string): AutoRoutine {
  return { id: createId(), name, alliance: null, isDefault: false, clearRequestsAtEnd: true, symmetry: { ...noSymmetry }, steps: [] };
}

export function createStep(type: AutoStepType, project: Pick<AutoProject, "states" | "field">): AutoStep {
  const state = project.states[0] ?? "";
  switch (type) {
    case "drive": return { id: createId(), type, x: round(project.field.length / 4), y: round(project.field.width / 2), heading: 0, subpoints: [], turn: { mode: "now" }, maxTurnRate: null, pointId: null, endHeadingTolerance: null,
      executeState: null, waitForState: null, stateTimeoutSeconds: null, ...defaultConstraints };
    case "requestState": return { id: createId(), type, state };
    case "waitForState": return { id: createId(), type, state, timeoutSeconds: null, replaySeconds: 0.5 };
    case "wait": return { id: createId(), type, seconds: 0.5 };
    case "branch": return { id: createId(), type, condition: state ? { kind: "state", state, waitSeconds: 0 } : { kind: "timeLeft", seconds: 5 },
      then: [], otherwise: [] };
  }
}

/** Every step, including the steps inside branches, in list order (a branch, its Then side, its Otherwise side). */
export function allSteps(steps: AutoStep[]): AutoStep[] {
  return steps.flatMap(step => step.type === "branch" ? [step, ...allSteps(step.then), ...allSteps(step.otherwise)] : [step]);
}

/** Maps every step, including the steps inside branches. Lists nothing changed in are kept as they were. */
export function mapSteps(steps: AutoStep[], map: (step: AutoStep) => AutoStep): AutoStep[] {
  let changed = false;
  const next = steps.map(step => {
    let inner = step;
    if (step.type === "branch") {
      const then = mapSteps(step.then, map);
      const otherwise = mapSteps(step.otherwise, map);
      if (then !== step.then || otherwise !== step.otherwise) inner = { ...step, then, otherwise };
    }
    const mapped = map(inner);
    if (mapped !== step) changed = true;
    return mapped;
  });
  return changed ? next : steps;
}

/** Removes the steps that fail `keep`, wherever they are; removing a branch removes its sides too. */
export function filterSteps(steps: AutoStep[], keep: (step: AutoStep) => boolean): AutoStep[] {
  let changed = false;
  const next = steps.flatMap((step): AutoStep[] => {
    if (!keep(step)) { changed = true; return []; }
    if (step.type !== "branch") return [step];
    const then = filterSteps(step.then, keep);
    const otherwise = filterSteps(step.otherwise, keep);
    if (then === step.then && otherwise === step.otherwise) return [step];
    changed = true;
    return [{ ...step, then, otherwise }];
  });
  return changed ? next : steps;
}

/** The steps one run takes: each branch is followed by the side `choices` picks (Then when unset). */
export function routeSteps(steps: AutoStep[], choices: BranchChoices = {}): AutoStep[] {
  return steps.flatMap(step => step.type === "branch" ? [step, ...routeSteps(step[choices[step.id] ?? "then"], choices)] : [step]);
}

/** The list a step is in and its index there, or null when it isn't in the auto. */
export function locateStep(steps: AutoStep[], id: string, list: ListRef = null): { list: ListRef; index: number } | null {
  for (const [index, step] of steps.entries()) {
    if (step.id === id) return { list, index };
    if (step.type !== "branch") continue;
    for (const arm of ["then", "otherwise"] as const) {
      const found = locateStep(step[arm], id, { branchId: step.id, arm });
      if (found) return found;
    }
  }
  return null;
}

/** Applies `update` to one list of steps: the auto's own, or one side of a branch. */
export function updateList(steps: AutoStep[], list: ListRef, update: (items: AutoStep[]) => AutoStep[]): AutoStep[] {
  if (list === null) return update(steps);
  return mapSteps(steps, step => {
    if (step.type !== "branch" || step.id !== list.branchId) return step;
    const items = update(step[list.arm]);
    return items === step[list.arm] ? step : { ...step, [list.arm]: items };
  });
}

/** Where new steps go: after a step, in its own list (the end of the auto when null), or at the end of one side of a branch. */
export type InsertTarget = { after: string | null } | { into: { branchId: string; arm: BranchArm } };

/** Inserts steps; branches can't hold branches, so a branch added inside one goes right after it. */
export function insertStepsAt(steps: AutoStep[], target: InsertTarget, added: AutoStep[]): AutoStep[] {
  const nesting = added.some(step => step.type === "branch");
  if ("into" in target) {
    return nesting ? insertStepsAt(steps, { after: target.into.branchId }, added) : updateList(steps, target.into, items => [...items, ...added]);
  }
  let place = target.after === null ? null : locateStep(steps, target.after);
  if (place?.list && nesting) place = locateStep(steps, place.list.branchId);
  if (!place) return [...steps, ...added];
  const { list, index } = place;
  return updateList(steps, list, items => [...items.slice(0, index + 1), ...added, ...items.slice(index + 1)]);
}

/** The selected steps that aren't inside a selected branch (which carries them), in list order. */
export function outermostSteps(steps: AutoStep[], ids: string[]): AutoStep[] {
  const carried = new Set(allSteps(steps).flatMap(step => step.type === "branch" && ids.includes(step.id)
    ? allSteps([...step.then, ...step.otherwise]).map(inner => inner.id) : []));
  return allSteps(steps).filter(step => ids.includes(step.id) && !carried.has(step.id));
}

/**
 * Moves steps (kept in order) so they sit before the step now at `index` of `list` (its length for
 * the end). Steps inside a moving branch travel with it, and branches can't move into a branch.
 */
export function moveStepsInto(steps: AutoStep[], ids: string[], list: ListRef, index: number): AutoStep[] {
  const moving = outermostSteps(steps, ids);
  const movingIds = new Set(moving.map(step => step.id));
  if (!moving.length) return steps;
  if (list && (moving.some(step => step.type === "branch") || !locateStep(steps, list.branchId) || allSteps(moving).some(step => step.id === list.branchId))) return steps;
  const target = list === null ? steps : (allSteps(steps).find(step => step.id === list.branchId) as BranchStep)[list.arm];
  const anchor = target.slice(index).find(step => !movingIds.has(step.id));
  const next = updateList(filterSteps(steps, step => !movingIds.has(step.id)), list, items => {
    const at = anchor ? items.findIndex(step => step.id === anchor.id) : items.length;
    return [...items.slice(0, at), ...moving, ...items.slice(at)];
  });
  return JSON.stringify(next) === JSON.stringify(steps) ? steps : next;
}

/** Moves steps that share one list a place earlier or later together, keeping their order; blocked at the ends. */
export function shiftSteps(steps: AutoStep[], ids: string[], offset: -1 | 1): AutoStep[] {
  const places = ids.flatMap(id => locateStep(steps, id) ?? []);
  const key = (list: ListRef) => list ? `${list.branchId}:${list.arm}` : "";
  if (!places.length || places.some(place => key(place.list) !== key(places[0].list))) return steps;
  return updateList(steps, places[0].list, items => {
    const indexes = places.map(place => place.index).sort((a, b) => a - b);
    if (offset < 0 ? indexes[0] === 0 : indexes[indexes.length - 1] === items.length - 1) return items;
    const next = [...items];
    for (const index of offset < 0 ? indexes : [...indexes].reverse()) [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  });
}

/** Seconds a branch waits for its condition first; 0 when it checks once. */
export const branchWaitSeconds = (step: BranchStep) => step.condition.kind === "timeLeft" ? 0 : step.condition.waitSeconds;

export function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/** Wraps degrees into (-180, 180] so headings stay readable. */
export function normalizeHeading(degrees: number) {
  // In-range headings pass through exactly; the modulo below adds floating-point noise.
  if (degrees > -180 && degrees <= 180) return degrees;
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function legConstraints(step: DriveStep): LegConstraints {
  return { maxVelocity: step.maxVelocity, maxAcceleration: step.maxAcceleration,
    endDistanceTolerance: step.endDistanceTolerance, endVelocityTolerance: step.endVelocityTolerance };
}

/** Flips across the field's center line (X) and/or its long axis (Y); applying it twice undoes it. */
export function flipPoint<T extends { x: number; y: number; heading: number }>(point: T, flips: Symmetry, field: AutoProject["field"]): T {
  let { x, y, heading } = point;
  if (flips.flipX) { x = field.length - x; heading = 180 - heading; }
  if (flips.flipY) { y = field.width - y; heading = -heading; }
  return { ...point, x: round(x, 4), y: round(y, 4), heading: round(normalizeHeading(heading), 4) };
}

/** Flipped steps no longer match their named points, so they are unlinked. */
export function flipSteps(steps: AutoStep[], flips: Symmetry, field: AutoProject["field"]) {
  return mapSteps(steps, step => {
    if (step.type !== "drive") return step;
    const facing = step.turn.mode === "face" ? flipPoint({ x: step.turn.x, y: step.turn.y, heading: 0 }, flips, field) : null;
    const turn: LegTurn = facing ? { mode: "face", x: facing.x, y: facing.y, pointId: null } : step.turn;
    return { ...flipPoint(step, flips, field), turn, pointId: null };
  });
}

/** The heading the robot ends the leg at: facing its point, or the leg's own heading. */
export function legEndHeading(step: DriveStep) {
  if (step.turn.mode !== "face") return step.heading;
  const dx = step.turn.x - step.x;
  const dy = step.turn.y - step.y;
  return Math.hypot(dx, dy) < 1e-3 ? step.heading : round(Math.atan2(dy, dx) * 180 / Math.PI, 2);
}

/**
 * Saves a named point and moves every step linked to it, in every auto, so the rest of the
 * builder only ever reads plain coordinates.
 */
export function setNamedPoint(document: AutoDocument, point: NamedPoint): AutoDocument {
  const exists = document.points.some(candidate => candidate.id === point.id);
  return {
    ...document,
    points: exists ? document.points.map(candidate => candidate.id === point.id ? point : candidate) : [...document.points, point],
    autos: document.autos.map(auto => ({ ...auto, steps: mapSteps(auto.steps, step => {
      if (step.type !== "drive") return step;
      let next = step;
      if (step.pointId === point.id) next = { ...next, x: point.x, y: point.y, heading: point.heading };
      if (step.turn.mode === "face" && step.turn.pointId === point.id) next = { ...next, turn: { ...step.turn, x: point.x, y: point.y } };
      return next;
    }) }))
  };
}

/** After an auto's steps change, moves each named point a linked step was moved off of, which moves every other step linked to it. */
export function syncNamedPoints(document: AutoDocument, autoId: string): AutoDocument {
  const auto = document.autos.find(candidate => candidate.id === autoId);
  if (!auto) return document;
  return allSteps(auto.steps).reduce((next, step) => {
    if (step.type !== "drive" || !step.pointId) return next;
    const point = next.points.find(candidate => candidate.id === step.pointId);
    return point && (point.x !== step.x || point.y !== step.y || point.heading !== step.heading)
      ? setNamedPoint(next, { ...point, x: step.x, y: step.y, heading: step.heading }) : next;
  }, document);
}

/** Removes a named point; steps that used it keep its coordinates but are no longer linked. */
export function deleteNamedPoint(document: AutoDocument, pointId: string): AutoDocument {
  return {
    ...document,
    points: document.points.filter(point => point.id !== pointId),
    autos: document.autos.map(auto => ({ ...auto, steps: mapSteps(auto.steps, step => step.type !== "drive" ? step : {
      ...step,
      pointId: step.pointId === pointId ? null : step.pointId,
      turn: step.turn.mode === "face" && step.turn.pointId === pointId ? { ...step.turn, pointId: null } : step.turn
    }) }))
  };
}

/** A name not already used by a named point, such as "Point 3". */
export function uniquePointName(document: AutoDocument) {
  const names = new Set(document.points.map(point => point.name.trim()));
  let number = document.points.length + 1;
  while (names.has(`Point ${number}`)) number++;
  return `Point ${number}`;
}

export const hasSymmetry = (symmetry: Symmetry) => symmetry.flipX || symmetry.flipY;

/** The generated copy for the other side, or null when symmetry is off. */
export function mirroredAuto(auto: AutoRoutine, field: AutoProject["field"]): AutoRoutine | null {
  if (!hasSymmetry(auto.symmetry)) return null;
  const alliance = auto.alliance === "Blue" ? "Red" : auto.alliance === "Red" ? "Blue" : null;
  return { ...auto, id: `${auto.id}:mirror`, name: `${auto.name.trim()} (${alliance ?? "mirrored"})`, alliance,
    isDefault: false, symmetry: { ...noSymmetry }, steps: flipSteps(auto.steps, auto.symmetry, field) };
}

/**
 * Fields a saved object has that this Power Tool doesn't know, kept so saving never drops what a newer
 * copy wrote. Each parser spreads them first and then sets the fields it knows.
 */
function extras(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Reads a saved document defensively: missing fields get defaults, and fields it doesn't know are
 * kept as they are. Unknown step types are dropped, which is why a new one needs a new file version.
 */
export function parseAutoDocument(value: unknown): AutoDocument {
  if (!value || typeof value !== "object" || !Array.isArray((value as { autos?: unknown }).autos)) return emptyDocument();
  const autos: AutoRoutine[] = [];
  for (const raw of (value as { autos: unknown[] }).autos) {
    if (!raw || typeof raw !== "object") continue;
    const auto = raw as Record<string, unknown>;
    const steps: AutoStep[] = [];
    for (const rawStep of Array.isArray(auto.steps) ? auto.steps : []) {
      const step = parseStep(rawStep);
      if (step) steps.push(step);
    }
    const symmetry = auto.symmetry && typeof auto.symmetry === "object" ? auto.symmetry as Record<string, unknown> : {};
    autos.push({
      ...auto,
      id: typeof auto.id === "string" && auto.id ? auto.id : createId(),
      name: typeof auto.name === "string" ? auto.name : "",
      alliance: auto.alliance === "Blue" || auto.alliance === "Red" ? auto.alliance : null,
      isDefault: false,
      clearRequestsAtEnd: true,
      symmetry: { ...symmetry, flipX: symmetry.flipX === true, flipY: symmetry.flipY === true },
      steps
    });
  }
  const period = (value as { periodSeconds?: unknown }).periodSeconds;
  const rawPoints = (value as { points?: unknown }).points;
  const points: NamedPoint[] = (Array.isArray(rawPoints) ? rawPoints : []).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object") return [];
    const point = raw as Record<string, unknown>;
    const coordinate = (key: string) => typeof point[key] === "number" ? point[key] as number : Number.NaN;
    // A point without a usable spot would move its linked steps off the field, so it is dropped.
    if (!Number.isFinite(coordinate("x")) || !Number.isFinite(coordinate("y"))) return [];
    return [{ ...point, id: typeof point.id === "string" && point.id ? point.id : createId(), name: typeof point.name === "string" ? point.name : "Point",
      x: coordinate("x"), y: coordinate("y"), heading: typeof point.heading === "number" ? point.heading : 0 }];
  });
  // Links to a missing point are dropped; linked steps are brought in line with their point.
  const ids = new Set(points.map(point => point.id));
  const linked = autos.map(auto => ({ ...auto, steps: mapSteps(auto.steps, step => step.type !== "drive" ? step : {
    ...step,
    pointId: step.pointId && ids.has(step.pointId) ? step.pointId : null,
    turn: step.turn.mode === "face" && step.turn.pointId && !ids.has(step.turn.pointId) ? { ...step.turn, pointId: null } : step.turn
  }) }));
  const document: AutoDocument = { ...extras(value), version: autosFileVersion, periodSeconds: typeof period === "number" && Number.isFinite(period) && period > 0 ? period : defaultPeriodSeconds,
    points, cameras: parseCameras((value as { cameras?: unknown }).cameras), autos: linked };
  return points.reduce(setNamedPoint, document);
}

/** Saved camera mounts; anything missing falls back to a new camera's value so a hand edit can't break the view. */
function parseCameras(value: unknown): CameraMount[] {
  return (Array.isArray(value) ? value : []).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object") return [];
    const saved = raw as Record<string, unknown>;
    const fallback = newCamera(typeof saved.name === "string" ? saved.name : "Camera");
    const number = (key: keyof CameraMount) =>
      typeof saved[key] === "number" && Number.isFinite(saved[key]) ? saved[key] as number : fallback[key] as number;
    return [{
      ...fallback,
      ...saved,
      name: fallback.name,
      id: typeof saved.id === "string" && saved.id ? saved.id : fallback.id,
      x: number("x"), y: number("y"), z: number("z"), yaw: number("yaw"), pitch: number("pitch"),
      // A zero or negative field of view would see nothing at all, so it falls back too.
      hFov: number("hFov") > 0 ? number("hFov") : fallback.hFov,
      vFov: number("vFov") > 0 ? number("vFov") : fallback.vFov,
      imageWidth: number("imageWidth") > 0 ? Math.round(number("imageWidth")) : fallback.imageWidth,
      enabled: saved.enabled !== false
    }];
  });
}

function parseTurn(value: unknown): LegTurn {
  if (!value || typeof value !== "object") return { mode: "now" };
  const turn = value as Record<string, unknown>;
  const number = (key: string) => typeof turn[key] === "number" ? turn[key] as number : Number.NaN;
  if (turn.mode === "later") return { ...turn, mode: "later", startProgress: number("startProgress") };
  if (turn.mode === "face") return { ...turn, mode: "face", x: number("x"), y: number("y"), pointId: typeof turn.pointId === "string" && turn.pointId ? turn.pointId : null };
  return { ...turn, mode: "now" };
}

function parseCondition(value: unknown): BranchCondition {
  const condition = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const number = (key: string, fallback = Number.NaN) => typeof condition[key] === "number" ? condition[key] as number : fallback;
  if (condition.kind === "timeLeft") return { ...condition, kind: "timeLeft", seconds: number("seconds") };
  if (condition.kind === "check") return { ...condition, kind: "check", method: typeof condition.method === "string" ? condition.method : "", waitSeconds: number("waitSeconds", 0) };
  return { ...condition, kind: "state", state: typeof condition.state === "string" ? condition.state : "", waitSeconds: number("waitSeconds", 0) };
}

function parseStep(value: unknown): AutoStep | null {
  if (!value || typeof value !== "object") return null;
  const step = value as Record<string, unknown>;
  const id = typeof step.id === "string" && step.id ? step.id : createId();
  const number = (key: string, fallback = Number.NaN) => typeof step[key] === "number" ? step[key] as number : fallback;
  const state = typeof step.state === "string" ? step.state : "";
  switch (step.type) {
    case "drive": return { ...step, id, type: "drive", x: number("x"), y: number("y"), heading: number("heading"),
      subpoints: (Array.isArray(step.subpoints) ? step.subpoints : []).flatMap((raw: unknown) => {
        if (!raw || typeof raw !== "object") return [];
        const subpoint = raw as Record<string, unknown>;
        return [{ ...subpoint, id: typeof subpoint.id === "string" && subpoint.id ? subpoint.id : createId(),
          progress: typeof subpoint.progress === "number" ? subpoint.progress : Number.NaN,
          state: typeof subpoint.state === "string" ? subpoint.state : "" }];
      }),
      turn: parseTurn(step.turn), pointId: typeof step.pointId === "string" && step.pointId ? step.pointId : null,
      maxTurnRate: typeof step.maxTurnRate === "number" ? step.maxTurnRate : null,
      endHeadingTolerance: step.endHeadingTolerance == null ? null : number("endHeadingTolerance"),
      executeState: typeof step.executeState === "string" && step.executeState ? step.executeState : null,
      waitForState: typeof step.waitForState === "string" && step.waitForState ? step.waitForState : null,
      stateTimeoutSeconds: null,
      ...Object.fromEntries(constraintKeys.map(key => [key, number(key, defaultConstraints[key])])) as LegConstraints };
    case "requestState": return { ...step, id, type: "requestState", state };
    case "waitForState": return { ...step, id, type: "waitForState", state, replaySeconds: number("replaySeconds", 0.5),
      timeoutSeconds: null };
    case "wait": return { ...step, id, type: "wait", seconds: number("seconds") };
    case "branch": {
      const arm = (key: string) => (Array.isArray(step[key]) ? step[key] as unknown[] : []).flatMap(raw => parseStep(raw) ?? []);
      return { ...step, id, type: "branch", condition: parseCondition(step.condition), then: arm("then"), otherwise: arm("otherwise") };
    }
    default: return null;
  }
}

const constraintNames: Record<keyof LegConstraints, string> = {
  maxVelocity: "Max velocity", maxAcceleration: "Max acceleration",
  endDistanceTolerance: "End distance tolerance", endVelocityTolerance: "End velocity tolerance"
};

/** Mirrors the exceptions Auto, AutoBuilder and DriveConstraints throw, plus field sanity checks. */
export function validateAutos(document: AutoDocument, project: AutoProject): AutoIssue[] {
  const issues: AutoIssue[] = [];
  const names = new Map<string, number>();
  const registered = document.autos.flatMap(auto => [auto, mirroredAuto(auto, project.field)].filter((candidate): candidate is AutoRoutine => candidate !== null));
  for (const auto of registered) names.set(auto.name.trim(), (names.get(auto.name.trim()) ?? 0) + 1);
  const states = new Set(project.states);

  for (const auto of document.autos) {
    const error = (message: string, stepId?: string) => issues.push({ autoId: auto.id, stepId, severity: "error", message });
    const warning = (message: string, stepId?: string) => issues.push({ autoId: auto.id, stepId, severity: "warning", message });
    const name = auto.name.trim();
    const mirror = mirroredAuto(auto, project.field);
    if (!name) error("Give this auto a name.");
    else if (name === "None") error("\"None\" is reserved by the auto chooser.");
    else if ((names.get(name) ?? 0) > 1) error(`Another auto is also named "${name}".`);
    if (name && mirror && (names.get(mirror.name) ?? 0) > 1) error(`The mirrored copy's name "${mirror.name}" is already used.`);
    // AutoBuilder throws on duplicate names at robot startup, including names from RobotAutos.java.
    for (const used of [name, mirror?.name].filter((candidate): candidate is string => Boolean(candidate))) {
      if (project.handWrittenNames?.includes(used)) {
        error(`Handwritten robot code already uses the name "${used}". Duplicate auto names stop robot code at startup; rename this auto.`);
      }
    }
    if (auto.steps.length === 0) warning("This auto has no steps and will do nothing.");

    const hasDrive = allSteps(auto.steps).some(step => step.type === "drive");
    if (hasDrive && project.driveCommandInstalled === false) {
      error("This robot project is missing the DriveToPose command that drive steps use. Install PowerLib templates to add it.");
    }

    for (const step of allSteps(auto.steps)) {
      if (step.type === "drive") {
        if (![step.x, step.y, step.heading].every(Number.isFinite)) error("Enter a finite X, Y and heading.", step.id);
        else if (step.x < 0 || step.x > project.field.length || step.y < 0 || step.y > project.field.width) {
          warning("This point is outside the field.", step.id);
        }
        for (const key of constraintKeys) {
          if (!Number.isFinite(step[key]) || step[key] <= 0) error(`${constraintNames[key]} must be a positive number.`, step.id);
        }
        if (step.endHeadingTolerance !== null && (!Number.isFinite(step.endHeadingTolerance)
            || step.endHeadingTolerance <= 0 || step.endHeadingTolerance > 180)) {
          error("End heading tolerance must be greater than 0 and at most 180 degrees.", step.id);
        }
        for (const state of [step.executeState, step.waitForState]) {
          if (state !== null && !states.has(state)) error(`RobotState.${state} does not exist in StateMachine.`, step.id);
        }
        if (step.turn.mode === "later" && !(step.turn.startProgress >= 0 && step.turn.startProgress <= 1)) {
          error("The turn must start between 0% and 100% of the leg.", step.id);
        }
        if (step.turn.mode === "face") {
          if (!Number.isFinite(step.turn.x) || !Number.isFinite(step.turn.y)) error("Enter a finite point to face.", step.id);
          else if (Math.hypot(step.turn.x - step.x, step.turn.y - step.y) < 0.3) warning("The point to face is on top of this target, so the robot can't aim at it there.", step.id);
        }
        if (step.maxTurnRate !== null && !(Number.isFinite(step.maxTurnRate) && step.maxTurnRate > 0)) {
          error("Max turn rate must be a positive number of degrees per second.", step.id);
        }
        for (const subpoint of step.subpoints) {
          if (!Number.isFinite(subpoint.progress) || subpoint.progress < 0 || subpoint.progress > 1) {
            error("Subpoint positions must be between 0% and 100% of the leg.", step.id);
          }
          if (!subpoint.state) error("Choose a state for each subpoint.", step.id);
          else if (!states.has(subpoint.state)) error(`Subpoint state RobotState.${subpoint.state} does not exist in StateMachine.`, step.id);
        }
      } else if (step.type === "requestState" || step.type === "waitForState") {
        if (!step.state) error("Choose a robot state.", step.id);
        else if (!states.has(step.state)) error(`RobotState.${step.state} does not exist in StateMachine.`, step.id);
        if (step.type === "waitForState") {
          if (!Number.isFinite(step.replaySeconds) || step.replaySeconds < 0) error("The replay estimate must be zero or more seconds.", step.id);
        }
      } else if (step.type === "wait") {
        if (!Number.isFinite(step.seconds) || step.seconds < 0) error("The wait must be a finite, non-negative number of seconds.", step.id);
      } else {
        const condition = step.condition;
        if (condition.kind === "state") {
          if (!condition.state) error("Choose the robot state to check.", step.id);
          else if (!states.has(condition.state)) error(`RobotState.${condition.state} does not exist in StateMachine.`, step.id);
        } else if (condition.kind === "check") {
          if (!condition.method) error("Choose the robot check.", step.id);
          else if (!/^[A-Za-z_$][\w$]*$/.test(condition.method) || (project.checks && !project.checks.includes(condition.method))) {
            error(`StateMachine has no public boolean ${condition.method}() method to check.`, step.id);
          }
        } else if (!Number.isFinite(condition.seconds) || condition.seconds <= 0) {
          error("The time left must be a positive number of seconds.", step.id);
        } else if (condition.seconds >= document.periodSeconds) {
          warning(`Autonomous lasts ${document.periodSeconds} s, so ${condition.seconds} s are never left here; this always runs Otherwise.`, step.id);
        }
        if (condition.kind !== "timeLeft" && !(Number.isFinite(condition.waitSeconds) && condition.waitSeconds >= 0)) {
          error("The wait must be zero or more seconds.", step.id);
        }
        if ([...step.then, ...step.otherwise].some(inner => inner.type === "branch")) error("A branch can't hold another branch. Move the inner one out.", step.id);
        if (!step.then.length && !step.otherwise.length) warning("This branch has no steps on either side, so it does nothing.", step.id);
      }
    }
  }
  return issues;
}

export function hasErrors(issues: AutoIssue[]) {
  return issues.some(issue => issue.severity === "error");
}

/** Drive subpoints in the order they run. */
export function orderedSubpoints(step: DriveStep) {
  return step.subpoints.map((subpoint, index) => ({ subpoint, index }))
    .sort((a, b) => a.subpoint.progress - b.subpoint.progress || a.index - b.index)
    .map(entry => entry.subpoint);
}

/**
 * For each step, the requested state when it starts (a drive leg's own subpoints apply after
 * its start); drawn as colored path bands.
 */
export function requestedStateAtSteps(auto: AutoRoutine) {
  let current: string | null = null;
  return auto.steps.map(step => {
    if (step.type === "requestState") current = step.state;
    const atStart = current;
    if (step.type === "drive") {
      for (const subpoint of orderedSubpoints(step)) current = subpoint.state;
      if (step.executeState !== null) current = step.executeState;
    }
    return atStart;
  });
}

/** Whether the auto makes any state request, directly or from a subpoint. */
export const requestsStates = (auto: AutoRoutine) =>
  allSteps(auto.steps).some(step => step.type === "requestState" || (step.type === "drive" && (step.subpoints.length > 0 || step.executeState !== null)));

export const generatedAutosClass = "GeneratedAutos";
export const generatedAutosHeader = "// POWERLIB GENERATED AUTOS - DO NOT EDIT";

const javaString = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
  .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;

/** Java double literal; integers keep a ".0" so they read as doubles. */
const javaDouble = (value: number) => {
  const text = String(round(value, 4));
  return /[.eE]/.test(text) ? text : `${text}.0`;
};

/**
 * True for a state request that runs straight into a move (only other requests in between).
 * It is made as that move starts, so the robot keeps moving instead of stopping for a cycle.
 */
export function requestJoinsNextMove(steps: AutoStep[], index: number) {
  if (steps[index]?.type !== "requestState") return false;
  let next = index + 1;
  while (steps[next]?.type === "requestState") next++;
  return steps[next]?.type === "drive";
}

/** Ids of the state requests that run straight into a move in their own list (see requestJoinsNextMove). */
export function joiningRequests(steps: AutoStep[]) {
  const ids = new Set<string>();
  const visit = (list: AutoStep[]) => list.forEach((step, index) => {
    if (requestJoinsNextMove(list, index)) ids.add(step.id);
    if (step.type === "branch") { visit(step.then); visit(step.otherwise); }
  });
  visit(steps);
  return ids;
}

/** Java constant names for the named points generated code uses, keyed by point id. */
type PointNames = Map<string, string>;

function pointConstantNames(points: NamedPoint[]): PointNames {
  const used = new Set(["OWNER"]);
  return new Map(points.map(point => {
    let base = point.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "POINT";
    if (/^[0-9]/.test(base)) base = `POINT_${base}`;
    let name = base;
    for (let suffix = 2; used.has(name); suffix++) name = `${base}_${suffix}`;
    used.add(name);
    return [point.id, name];
  }));
}

/** Indents every line after the first, so a multi-line expression can sit inside another. */
const indent = (source: string, spaces: number) => source.replace(/\n/g, `\n${" ".repeat(spaces)}`);
/** A Java call with one argument per line. */
const javaCall = (name: string, args: string[]) => `${name}(\n    ${args.map(arg => indent(arg, 4)).join(",\n    ")})`;

/** What a branch checks, as a Java boolean expression. */
function conditionJava(condition: BranchCondition) {
  switch (condition.kind) {
    case "state": return `robot.getActualState() == RobotState.${condition.state}`;
    case "check": return `robot.${condition.method}()`;
    case "timeLeft": return `secondsLeft() >= ${javaDouble(condition.seconds)}`;
  }
}

/** The command expressions a step runs; `leadingStates` are requests made as this move starts (requests placed just before it). */
function stepCommands(step: AutoStep, leadingStates: string[], names: PointNames): string[] {
  switch (step.type) {
    case "drive": {
      // A pose linked to a named point uses its constant, unless the leg faces a point instead.
      const linked = step.pointId ? names.get(step.pointId) : undefined;
      const pose = linked && step.turn.mode !== "face" ? linked
        : `new Pose2d(${javaDouble(step.x)}, ${javaDouble(step.y)}, Rotation2d.fromDegrees(${javaDouble(legEndHeading(step))}))`;
      const facePoint = step.turn.mode === "face" ? (step.turn.pointId && names.get(step.turn.pointId)
        ? `${names.get(step.turn.pointId)}.getTranslation()` : `new Translation2d(${javaDouble(step.turn.x)}, ${javaDouble(step.turn.y)})`) : null;
      const turning = step.turn.mode === "later" ? `\n    .turningAfter(${javaDouble(step.turn.startProgress)})`
        : facePoint ? `\n    .facing(${facePoint})` : "";
      const turnRate = step.maxTurnRate !== null ? `\n    .withMaxTurnRate(Math.toRadians(${javaDouble(step.maxTurnRate)}))` : "";
      const headingCompletion = step.endHeadingTolerance !== null
        ? `\n    .withHeadingTolerance(Rotation2d.fromDegrees(${javaDouble(step.endHeadingTolerance)}))` : "";
      const limits = `new DriveConstraints(${constraintKeys.map(key => javaDouble(step[key])).join(", ")})`;
      const subpoints = [...leadingStates.map(state => ({ progress: 0, state })), ...orderedSubpoints(step)].map(subpoint =>
        `\n    .atProgress(${javaDouble(subpoint.progress)}, () -> robot.requestState(RobotState.${subpoint.state}, OWNER))`).join("");
      const arrival = [];
      if (step.executeState !== null) arrival.push(`new RequestState(RobotState.${step.executeState}, OWNER, robot)`);
      if (step.waitForState !== null) {
        const wait = `Commands.waitUntil(() -> robot.getActualState() == RobotState.${step.waitForState})`;
        arrival.push(wait);
      }
      return [`new DriveToPose(robot.drivetrain, ${pose}, ${limits})${turning}${turnRate}${headingCompletion}${subpoints}`, ...arrival];
    }
    case "requestState":
      return [`new RequestState(RobotState.${step.state}, OWNER, robot)`];
    case "waitForState": {
      const wait = `Commands.waitUntil(() -> robot.getActualState() == RobotState.${step.state})`;
      return [wait];
    }
    case "wait":
      return [`Commands.waitSeconds(${javaDouble(step.seconds)})`];
    case "branch": {
      // Commands.either decides when the branch starts, after any wait for the condition.
      const condition = conditionJava(step.condition);
      const wait = branchWaitSeconds(step) > 0 ? [`Commands.waitUntil(() -> ${condition}).withTimeout(${javaDouble(branchWaitSeconds(step))})`] : [];
      return [...wait, javaCall("Commands.either", [sequenceJava(step.then, names), sequenceJava(step.otherwise, names), `() -> ${condition}`])];
    }
  }
}

/** The commands a list of steps runs, with requests that run into a move attached to that move. */
function listCommands(steps: AutoStep[], names: PointNames) {
  const commands: string[] = [];
  let leading: string[] = [];
  steps.forEach((step, index) => {
    if (requestJoinsNextMove(steps, index)) leading.push((step as RequestStateStep).state);
    else {
      commands.push(...stepCommands(step, step.type === "drive" ? leading : [], names));
      leading = [];
    }
  });
  return commands;
}

/** One side of a branch as a single command. */
function sequenceJava(steps: AutoStep[], names: PointNames) {
  const commands = listCommands(steps, names);
  return commands.length === 0 ? "Commands.none()" : commands.length === 1 ? commands[0] : javaCall("Commands.sequence", commands);
}

const timesAuto = (auto: AutoRoutine) => allSteps(auto.steps).some(step => step.type === "branch" && step.condition.kind === "timeLeft");

function autoRegistration(auto: AutoRoutine, names: PointNames) {
  const start = routeSteps(auto.steps).find((step): step is DriveStep => step.type === "drive");
  const calls = [
    ...(auto.alliance ? [`.withAlliance(Alliance.${auto.alliance})`] : []),
    // Branches on the time left count from when this auto starts.
    ...(timesAuto(auto) ? [".addCommand(() -> Commands.runOnce(AUTO_TIMER::restart))"] : []),
    // Simulation has no vision, so the simulated robot starts at point 1 (the replay's start).
    ...(start ? [`.addCommand(() -> startInSimulation(robot, new Pose2d(${javaDouble(start.x)}, ${javaDouble(start.y)}, Rotation2d.fromDegrees(${javaDouble(legEndHeading(start))}))))`] : []),
    ...listCommands(auto.steps, names).map(command => `.addCommand(() -> ${indent(command, 8)})`),
  ];
  const definition = [`new Auto(${javaString(auto.name.trim())})`, ...calls.map(call => `        ${call}`)].join("\n");
  const cleanup = ".finallyDo(interrupted -> robot.clearRequest(OWNER))";
  const alliance = auto.alliance ? `, Alliance.${auto.alliance}` : "";
  return `    autoBuilder.addAuto(${javaString(auto.name.trim())}${alliance}, () ->\n        ${definition}.build()${cleanup});`;
}

/** Generates GeneratedAutos.java. Callers must validate first; invalid documents throw. */
export function generateAutosJava(document: AutoDocument, project: AutoProject) {
  if (hasErrors(validateAutos(document, project))) throw new Error("Fix the auto errors before updating code.");
  // Only named points that generated autos use become constants (mirrored copies use plain poses).
  const usedPoints = new Set(document.autos.flatMap(auto => allSteps(auto.steps).flatMap(step => step.type !== "drive" ? []
    : [step.pointId, step.turn.mode === "face" ? step.turn.pointId : null].filter((id): id is string => id !== null))));
  const points = document.points.filter(point => usedPoints.has(point.id));
  const names = pointConstantNames(points);
  const constants = points.map(point => `  private static final Pose2d ${names.get(point.id)} = new Pose2d(${javaDouble(point.x)}, ${javaDouble(point.y)}, Rotation2d.fromDegrees(${javaDouble(point.heading)}));`);
  const autos = document.autos.flatMap(auto => {
    const mirror = mirroredAuto(auto, project.field);
    return mirror ? [autoRegistration(auto, names), autoRegistration(mirror, names)] : [autoRegistration(auto, names)];
  });
  const translationImport = autos.some(source => source.includes("new Translation2d(")) ? "\nimport edu.wpi.first.math.geometry.Translation2d;" : "";
  const timed = document.autos.some(timesAuto);
  return `${generatedAutosHeader}
// Power Tool writes this file from power-tool/generated/powerlib-autos.json.
// Edit autos in the Power Tool Auto Builder; hand-written autos belong in RobotAutos.java.
package frc.robot.autos;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;${translationImport}
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import edu.wpi.first.wpilibj.RobotBase;${timed ? "\nimport edu.wpi.first.wpilibj.Timer;" : ""}
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import frc.powerlib.auto.Auto;
import frc.powerlib.auto.AutoBuilder;
import frc.powerlib.auto.DriveConstraints;
import frc.robot.commands.DriveToPose;
import frc.robot.commands.RequestState;
import frc.robot.subsystems.StateMachine;
import frc.robot.subsystems.StateMachine.RobotState;

/** Autos built in the Power Tool Auto Builder. */
public final class ${generatedAutosClass} {
  /** Owns the state requests made by generated autos. */
  private static final Object OWNER = new Object();${timed ? `
  /** Restarted by each generated auto that branches on the time left. */
  private static final Timer AUTO_TIMER = new Timer();` : ""}
${constants.length ? `\n  // Named points from the Auto Builder; moving one there moves it in every auto.\n${constants.join("\n")}\n` : ""}
  private ${generatedAutosClass}() {}

  /** In simulation only, puts the robot at the auto's first point; a real robot keeps its vision pose. */
  private static Command startInSimulation(StateMachine robot, Pose2d start) {
    return Commands.runOnce(() -> {
      if (RobotBase.isSimulation()) robot.drivetrain.resetPose(start);
    }, robot.drivetrain);
  }
${timed ? `
  /** Seconds left in the ${document.periodSeconds} s autonomous period, counted from when the running auto started. */
  private static double secondsLeft() {
    return ${javaDouble(document.periodSeconds)} - AUTO_TIMER.get();
  }
` : ""}
  public static void register(AutoBuilder autoBuilder, StateMachine robot) {
${autos.length ? autos.join("\n\n") : "    // No autos yet. Build one in the Power Tool Auto Builder."}
  }
}
`;
}
