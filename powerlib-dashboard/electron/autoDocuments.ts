import { autosFileVersion, parseAutoDocument, type AutoDocument } from "./autoModel.js";

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid auto document structure.");
  return value as Record<string, unknown>;
};
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const unsupported = () => { throw Error("This auto document uses editing features not supported by this version of the editor. Its contents have been preserved."); };

/** Refuse lossy parsing, including unknown step types within an otherwise supported file version. */
export function readAutoDocument(value: unknown): AutoDocument {
  const raw = record(value);
  const version = raw.version ?? 1;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) throw Error("Invalid auto file version.");
  if (version > autosFileVersion) throw Error(`This auto document was saved by a newer Power Tool (version ${version}). Update Power Tool before editing it.`);
  if (!Array.isArray(raw.autos) || raw.autos.length > 500) throw Error("Invalid auto list (maximum 500 autos).");
  if (raw.periodSeconds !== undefined && (!finite(raw.periodSeconds) || (raw.periodSeconds as number) <= 0)) throw Error("Invalid autonomous period.");
  for (const key of ["points", "cameras"]) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) throw Error(`Invalid ${key} list.`);
    if (key === "cameras" && (raw[key] as unknown[] | undefined)?.length) unsupported();
  }
  const ids = new Set<string>();
  let steps = 0;
  const id = (value: unknown) => {
    if (typeof value !== "string" || !value || value.length > 200 || ids.has(value)) throw Error("Auto and step IDs must be unique, nonempty strings.");
    ids.add(value);
  };
  const pointIds = new Set<string>();
  const points = (raw.points ?? []) as unknown[];
  if (points.length > 5000) throw Error("Auto document exceeds 5000 named points.");
  for (const entry of points) {
    const point = record(entry); id(point.id); pointIds.add(point.id as string);
    if (typeof point.name !== "string" || point.name.length > 100 || /[\x00-\x1f\x7f]/.test(point.name)) throw Error("Invalid named point name.");
    if (![point.x, point.y, point.heading].every(finite)) throw Error("Named point coordinates must be finite numbers.");
  }
  const checkSteps = (items: unknown, nested = false) => {
    if (!Array.isArray(items)) throw Error("Every auto and branch arm must have a step list.");
    steps += items.length;
    if (steps > 10000) throw Error("Auto document exceeds 10000 steps.");
    for (const item of items) {
      const step = record(item); id(step.id);
      switch (step.type) {
        case "drive": {
          if (![step.x, step.y, step.heading].every(finite)) throw Error("Drive coordinates must be finite numbers.");
          for (const key of ["maxVelocity", "maxAcceleration", "endDistanceTolerance", "endVelocityTolerance"])
            if (step[key] !== undefined && !finite(step[key])) throw Error("Drive limits must be finite numbers.");
          if (step.endHeadingTolerance != null && !finite(step.endHeadingTolerance)) throw Error("Heading tolerance must be a finite number or null.");
          for (const key of ["executeState", "waitForState"])
            if (step[key] != null && typeof step[key] !== "string") throw Error("Point state settings must name a robot state or be null.");
          if (step.stateTimeoutSeconds != null && !finite(step.stateTimeoutSeconds)) throw Error("Invalid legacy point state timeout.");
          const link = (value: unknown) => { if (value != null && (typeof value !== "string" || !pointIds.has(value))) throw Error("Point links must reference an existing named point."); };
          link(step.pointId);
          if (step.maxTurnRate != null && !finite(step.maxTurnRate)) throw Error("Turn rate must be finite or null.");
          if (step.subpoints !== undefined && !Array.isArray(step.subpoints)) throw Error("Invalid subpoint list.");
          const subpoints = (step.subpoints ?? []) as unknown[];
          if (subpoints.length > 1000) throw Error("A drive leg exceeds 1000 subpoints.");
          for (const entry of subpoints) {
            const subpoint = record(entry); id(subpoint.id);
            if (!finite(subpoint.progress) || typeof subpoint.state !== "string") throw Error("Invalid subpoint position or state.");
          }
          if (step.turn !== undefined) {
            const turn = record(step.turn);
            if (turn.mode === "later") { if (!finite(turn.startProgress)) throw Error("Invalid delayed turning position."); }
            else if (turn.mode === "face") { if (![turn.x, turn.y].every(finite)) throw Error("Invalid facing target."); link(turn.pointId); }
            else if (turn.mode !== "now") unsupported();
          }
          break;
        }
        case "requestState":
        case "waitForState":
          if (typeof step.state !== "string") throw Error("A state step must name a robot state.");
          if (step.type === "waitForState" && step.timeoutSeconds != null && !finite(step.timeoutSeconds)) throw Error("Invalid legacy wait timeout.");
          if (step.replaySeconds !== undefined && !finite(step.replaySeconds)) throw Error("Invalid wait estimate.");
          break;
        case "wait":
          if (!finite(step.seconds)) throw Error("Wait duration must be a finite number.");
          break;
        case "branch": {
          if (nested) throw Error("Branches cannot contain another branch.");
          const condition = record(step.condition);
          if (condition.kind === "state" || condition.kind === "check") {
            if (typeof condition[condition.kind === "state" ? "state" : "method"] !== "string" || !finite(condition.waitSeconds)) throw Error("Invalid branch condition.");
          } else if (condition.kind === "timeLeft") { if (!finite(condition.seconds)) throw Error("Invalid remaining time condition."); }
          else unsupported();
          checkSteps(step.then, true); checkSteps(step.otherwise, true);
          break;
        }
        default: unsupported();
      }
    }
  };
  for (const entry of raw.autos) {
    const auto = record(entry); id(auto.id);
    if (typeof auto.name !== "string" || auto.name.length > 100 || /[\x00-\x1f\x7f]/.test(auto.name)) throw Error("Auto names must be single-line text up to 100 characters.");
    if (auto.alliance !== undefined && auto.alliance !== null && auto.alliance !== "Blue" && auto.alliance !== "Red") throw Error("Invalid auto alliance.");
    for (const key of ["isDefault", "clearRequestsAtEnd"]) if (auto[key] !== undefined && typeof auto[key] !== "boolean") throw Error(`Invalid ${key} value.`);
    if (auto.symmetry !== undefined) {
      const symmetry = record(auto.symmetry);
      for (const key of ["flipX", "flipY"]) if (symmetry[key] !== undefined && typeof symmetry[key] !== "boolean") throw Error("Invalid symmetry setting.");
    }
    checkSteps(auto.steps);
  }
  return parseAutoDocument(raw);
}
