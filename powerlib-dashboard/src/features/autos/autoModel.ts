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

export type DriveStep = { id: string; type: "drive"; x: number; y: number; heading: number; subpoints: Subpoint[] } & LegConstraints;
export type RequestStateStep = { id: string; type: "requestState"; state: string };
/** replaySeconds only paces the replay; the robot waits for the real state. */
export type WaitForStateStep = { id: string; type: "waitForState"; state: string; timeoutSeconds: number | null; replaySeconds: number };
export type WaitStep = { id: string; type: "wait"; seconds: number };
export type AutoStep = DriveStep | RequestStateStep | WaitForStateStep | WaitStep;
export type AutoStepType = AutoStep["type"];

/** Flips that produce the auto's mirrored copy for the other side of the field. */
export type Symmetry = { flipX: boolean; flipY: boolean };

export type AutoRoutine = {
  id: string;
  name: string;
  alliance: Alliance | null;
  isDefault: boolean;
  clearRequestsAtEnd: boolean;
  symmetry: Symmetry;
  steps: AutoStep[];
};

export type AutoDocument = { version: 1; autos: AutoRoutine[] };

/** What the builder knows about the robot project it generates for. */
export type AutoProject = {
  states: string[];
  /** Whether DriveToPose and DriveConstraints exist in the project; null when unknown. */
  driveCommandInstalled: boolean | null;
  field: { length: number; width: number };
  /** String literals in RobotAutos.java, which include the names of hand-written autos. */
  handWrittenNames?: string[];
};

export type AutoIssue = { autoId: string; stepId?: string; severity: "error" | "warning"; message: string };

export const stepLabels: Record<AutoStepType, string> = {
  drive: "Drive to point",
  requestState: "Request state",
  waitForState: "Wait for state",
  wait: "Wait"
};

/** Same values as DriveConstraints.DEFAULT on the robot. */
export const defaultConstraints: LegConstraints = { maxVelocity: 3, maxAcceleration: 3, endDistanceTolerance: 0.05, endVelocityTolerance: 0.1 };
export const constraintKeys = Object.keys(defaultConstraints) as (keyof LegConstraints)[];
export const noSymmetry: Symmetry = { flipX: false, flipY: false };

export const emptyDocument = (): AutoDocument => ({ version: 1, autos: [] });

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
    case "drive": return { id: createId(), type, x: round(project.field.length / 4), y: round(project.field.width / 2), heading: 0, subpoints: [], ...defaultConstraints };
    case "requestState": return { id: createId(), type, state };
    case "waitForState": return { id: createId(), type, state, timeoutSeconds: null, replaySeconds: 0.5 };
    case "wait": return { id: createId(), type, seconds: 0.5 };
  }
}

export function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/** Wraps degrees into (-180, 180] so headings stay readable. */
export function normalizeHeading(degrees: number) {
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

export function flipSteps(steps: AutoStep[], flips: Symmetry, field: AutoProject["field"]) {
  return steps.map(step => step.type === "drive" ? flipPoint(step, flips, field) : step);
}

export const hasSymmetry = (symmetry: Symmetry) => symmetry.flipX || symmetry.flipY;

/** The generated copy for the other side, or null when symmetry is off. */
export function mirroredAuto(auto: AutoRoutine, field: AutoProject["field"]): AutoRoutine | null {
  if (!hasSymmetry(auto.symmetry)) return null;
  const alliance = auto.alliance === "Blue" ? "Red" : auto.alliance === "Red" ? "Blue" : null;
  return { ...auto, id: `${auto.id}:mirror`, name: `${auto.name.trim()} (${alliance ?? "mirrored"})`, alliance,
    isDefault: false, symmetry: { ...noSymmetry }, steps: flipSteps(auto.steps, auto.symmetry, field) };
}

/** Reads a saved document defensively; unknown fields are dropped, missing ones get defaults. */
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
      id: typeof auto.id === "string" && auto.id ? auto.id : createId(),
      name: typeof auto.name === "string" ? auto.name : "",
      alliance: auto.alliance === "Blue" || auto.alliance === "Red" ? auto.alliance : null,
      isDefault: auto.isDefault === true,
      clearRequestsAtEnd: auto.clearRequestsAtEnd !== false,
      symmetry: { flipX: symmetry.flipX === true, flipY: symmetry.flipY === true },
      steps
    });
  }
  return { version: 1, autos };
}

function parseStep(value: unknown): AutoStep | null {
  if (!value || typeof value !== "object") return null;
  const step = value as Record<string, unknown>;
  const id = typeof step.id === "string" && step.id ? step.id : createId();
  const number = (key: string, fallback = Number.NaN) => typeof step[key] === "number" ? step[key] as number : fallback;
  const state = typeof step.state === "string" ? step.state : "";
  switch (step.type) {
    case "drive": return { id, type: "drive", x: number("x"), y: number("y"), heading: number("heading"),
      subpoints: (Array.isArray(step.subpoints) ? step.subpoints : []).flatMap((raw: unknown) => {
        if (!raw || typeof raw !== "object") return [];
        const subpoint = raw as Record<string, unknown>;
        return [{ id: typeof subpoint.id === "string" && subpoint.id ? subpoint.id : createId(),
          progress: typeof subpoint.progress === "number" ? subpoint.progress : Number.NaN,
          state: typeof subpoint.state === "string" ? subpoint.state : "" }];
      }),
      ...Object.fromEntries(constraintKeys.map(key => [key, number(key, defaultConstraints[key])])) as LegConstraints };
    case "requestState": return { id, type: "requestState", state };
    case "waitForState": return { id, type: "waitForState", state, replaySeconds: number("replaySeconds", 0.5),
      timeoutSeconds: step.timeoutSeconds === null || step.timeoutSeconds === undefined ? null : number("timeoutSeconds") };
    case "wait": return { id, type: "wait", seconds: number("seconds") };
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
  const defaults = document.autos.filter(auto => auto.isDefault);
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
        error(`RobotAutos.java already uses the name "${used}". Duplicate auto names stop robot code at startup; rename this auto.`);
      }
    }
    if (auto.isDefault && defaults.length > 1) error("Only one auto can be the default.");
    if (auto.steps.length === 0) warning("This auto has no steps and will do nothing.");

    const hasDrive = auto.steps.some(step => step.type === "drive");
    if (hasDrive && project.driveCommandInstalled === false) {
      error("This robot project is missing the DriveToPose command that drive steps use. Install PowerLib templates to add it.");
    }

    for (const step of auto.steps) {
      if (step.type === "drive") {
        if (![step.x, step.y, step.heading].every(Number.isFinite)) error("Enter a finite X, Y and heading.", step.id);
        else if (step.x < 0 || step.x > project.field.length || step.y < 0 || step.y > project.field.width) {
          warning("This point is outside the field.", step.id);
        }
        for (const key of constraintKeys) {
          if (!Number.isFinite(step[key]) || step[key] <= 0) error(`${constraintNames[key]} must be a positive number.`, step.id);
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
          if (step.timeoutSeconds !== null && (!Number.isFinite(step.timeoutSeconds) || step.timeoutSeconds <= 0)) {
            error("The timeout must be a positive number of seconds.", step.id);
          }
          if (!Number.isFinite(step.replaySeconds) || step.replaySeconds < 0) error("The replay estimate must be zero or more seconds.", step.id);
        }
      } else if (!Number.isFinite(step.seconds) || step.seconds < 0) {
        error("The wait must be a finite, non-negative number of seconds.", step.id);
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
    if (step.type === "drive") for (const subpoint of orderedSubpoints(step)) current = subpoint.state;
    return atStart;
  });
}

/** Whether the auto makes any state request, directly or from a subpoint. */
export const requestsStates = (auto: AutoRoutine) =>
  auto.steps.some(step => step.type === "requestState" || (step.type === "drive" && step.subpoints.length > 0));

export const generatedAutosClass = "GeneratedAutos";
export const generatedAutosHeader = "// POWERLIB GENERATED AUTOS - DO NOT EDIT";

const javaString = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
  .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;

/** Java double literal; integers keep a ".0" so they read as doubles. */
const javaDouble = (value: number) => {
  const text = String(round(value, 4));
  return /[.eE]/.test(text) ? text : `${text}.0`;
};

function stepCall(step: AutoStep) {
  switch (step.type) {
    case "drive": {
      const pose = `new Pose2d(${javaDouble(step.x)}, ${javaDouble(step.y)}, Rotation2d.fromDegrees(${javaDouble(step.heading)}))`;
      const limits = `new DriveConstraints(${constraintKeys.map(key => javaDouble(step[key])).join(", ")})`;
      const subpoints = orderedSubpoints(step).map(subpoint =>
        `\n            .atProgress(${javaDouble(subpoint.progress)}, () -> robot.requestState(RobotState.${subpoint.state}, OWNER))`).join("");
      return `.addCommand(() -> new DriveToPose(robot.drivetrain, ${pose}, ${limits})${subpoints})`;
    }
    case "requestState":
      return `.addCommand(() -> new RequestState(RobotState.${step.state}, OWNER, robot))`;
    case "waitForState": {
      const wait = `Commands.waitUntil(() -> robot.getActualState() == RobotState.${step.state})`;
      return `.addCommand(() -> ${wait}${step.timeoutSeconds === null ? "" : `.withTimeout(${javaDouble(step.timeoutSeconds)})`})`;
    }
    case "wait":
      return `.addCommand(() -> Commands.waitSeconds(${javaDouble(step.seconds)}))`;
  }
}

function autoRegistration(auto: AutoRoutine) {
  const calls = [
    ...(auto.alliance ? [`.withAlliance(Alliance.${auto.alliance})`] : []),
    ...auto.steps.map(stepCall),
    ...(auto.clearRequestsAtEnd && requestsStates(auto)
      ? [".addCommand(() -> Commands.runOnce(() -> robot.clearRequest(OWNER), robot))"] : [])
  ];
  const definition = [`new Auto(${javaString(auto.name.trim())})`, ...calls.map(call => `        ${call}`)].join("\n");
  return `    autoBuilder.${auto.isDefault ? "setDefaultAuto" : "addAuto"}(${definition});`;
}

/** Generates GeneratedAutos.java. Callers must validate first; invalid documents throw. */
export function generateAutosJava(document: AutoDocument, project: AutoProject) {
  if (hasErrors(validateAutos(document, project))) throw new Error("Fix the auto errors before updating code.");
  const autos = document.autos.flatMap(auto => {
    const mirror = mirroredAuto(auto, project.field);
    return mirror ? [autoRegistration(auto), autoRegistration(mirror)] : [autoRegistration(auto)];
  });
  return `${generatedAutosHeader}
// Power Tool writes this file from power-tool/generated/powerlib-autos.json.
// Edit autos in the Power Tool Auto Builder; hand-written autos belong in RobotAutos.java.
package frc.robot.autos;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
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
  private static final Object OWNER = new Object();

  private ${generatedAutosClass}() {}

  public static void register(AutoBuilder autoBuilder, StateMachine robot) {
${autos.length ? autos.join("\n\n") : "    // No autos yet. Build one in the Power Tool Auto Builder."}
  }
}
`;
}
