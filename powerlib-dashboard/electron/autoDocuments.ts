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
    if ((raw[key] as unknown[] | undefined)?.length) unsupported();
  }
  const ids = new Set<string>();
  let steps = 0;
  const id = (value: unknown) => {
    if (typeof value !== "string" || !value || value.length > 200 || ids.has(value)) throw Error("Auto and step IDs must be unique, nonempty strings.");
    ids.add(value);
  };
  for (const entry of raw.autos) {
    const auto = record(entry); id(auto.id);
    if (typeof auto.name !== "string" || auto.name.length > 100 || /[\x00-\x1f\x7f]/.test(auto.name)) throw Error("Auto names must be single-line text up to 100 characters.");
    if (auto.alliance !== undefined && auto.alliance !== null && auto.alliance !== "Blue" && auto.alliance !== "Red") throw Error("Invalid auto alliance.");
    for (const key of ["isDefault", "clearRequestsAtEnd"]) if (auto[key] !== undefined && typeof auto[key] !== "boolean") throw Error(`Invalid ${key} value.`);
    if (auto.symmetry !== undefined) {
      const symmetry = record(auto.symmetry);
      for (const key of ["flipX", "flipY"]) if (symmetry[key] !== undefined && typeof symmetry[key] !== "boolean") throw Error("Invalid symmetry setting.");
      if (symmetry.flipX || symmetry.flipY) unsupported();
    }
    if (!Array.isArray(auto.steps)) throw Error("Every auto must have a step list.");
    steps += auto.steps.length;
    if (steps > 10000) throw Error("Auto document exceeds 10000 steps.");
    for (const item of auto.steps) {
      const step = record(item); id(step.id);
      switch (step.type) {
        case "drive":
          if (![step.x, step.y, step.heading].every(finite)) throw Error("Drive coordinates must be finite numbers.");
          for (const key of ["maxVelocity", "maxAcceleration", "endDistanceTolerance", "endVelocityTolerance"])
            if (step[key] !== undefined && !finite(step[key])) throw Error("Drive limits must be finite numbers.");
          if (step.endHeadingTolerance != null && !finite(step.endHeadingTolerance)) throw Error("Heading tolerance must be a finite number or null.");
          for (const key of ["executeState", "waitForState"])
            if (step[key] != null && typeof step[key] !== "string") throw Error("Point state settings must name a robot state or be null.");
          if (step.stateTimeoutSeconds != null && !finite(step.stateTimeoutSeconds)) throw Error("Point state timeout must be a finite number or null.");
          if (step.subpoints !== undefined && !Array.isArray(step.subpoints)) throw Error("Invalid subpoint list.");
          if ((step.subpoints as unknown[] | undefined)?.length || step.pointId || step.maxTurnRate != null) unsupported();
          if (step.turn !== undefined && record(step.turn).mode !== "now") unsupported();
          break;
        case "requestState":
        case "waitForState":
          if (typeof step.state !== "string") throw Error("A state step must name a robot state.");
          if (step.type === "waitForState" && step.timeoutSeconds != null && !finite(step.timeoutSeconds)) throw Error("Wait timeout must be a finite number.");
          if (step.replaySeconds !== undefined && !finite(step.replaySeconds)) throw Error("Invalid wait estimate.");
          break;
        case "wait":
          if (!finite(step.seconds)) throw Error("Wait duration must be a finite number.");
          break;
        default: unsupported();
      }
    }
  }
  return parseAutoDocument(raw);
}
