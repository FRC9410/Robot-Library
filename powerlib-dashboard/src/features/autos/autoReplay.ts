// Ideal-motion replay of an auto: the robot moves exactly as commanded, using the same math as
// frc.powerlib.auto.DriveToPoseController. Keep the two in sync.
import type { AutoRoutine, AutoStep, LegConstraints } from "./autoModel";
import { legConstraints, normalizeHeading, orderedSubpoints, requestsStates } from "./autoModel";

export const loopPeriodSeconds = 0.02;
export const positionGain = 4.0;
/** Matches the default SwerveConstants.DRIVE_TO_POINT_MAX_ANGULAR_RATE_RADIANS_PER_SECOND (π rad/s). */
export const replayTurnRateDegreesPerSecond = 180;
/** A leg that has not finished after this long is reported and the replay moves on. */
export const legTimeoutSeconds = 10;

type Vector = { x: number; y: number };
export type ReplayFrame = { t: number; x: number; y: number; heading: number; speed: number; stepIndex: number };
export type ReplaySegment = { stepId: string; stepIndex: number; type: AutoStep["type"] | "clearRequests"; start: number; end: number; state: string | null };
/** When the requested state changes; subpointId is set for requests made during a drive leg. */
export type StateChange = { t: number; state: string | null; stepId: string; subpointId?: string };
export type Replay = { frames: ReplayFrame[]; segments: ReplaySegment[]; stateChanges: StateChange[]; duration: number; unfinishedStepIds: string[] };

const length = (v: Vector) => Math.hypot(v.x, v.y);

/** One controller cycle: returns the new commanded velocity. */
export function legCommand(position: Vector, target: Vector, previous: Vector, limits: LegConstraints): Vector {
  const error = { x: target.x - position.x, y: target.y - position.y };
  const distance = length(error);
  const speed = Math.min(limits.maxVelocity, Math.sqrt(2 * limits.maxAcceleration * distance), positionGain * distance);
  const desired = distance > 1e-9 ? { x: error.x * speed / distance, y: error.y * speed / distance } : { x: 0, y: 0 };
  let change = { x: desired.x - previous.x, y: desired.y - previous.y };
  const maxChange = limits.maxAcceleration * loopPeriodSeconds;
  const size = length(change);
  if (size > maxChange) change = { x: change.x * maxChange / size, y: change.y * maxChange / size };
  return { x: previous.x + change.x, y: previous.y + change.y };
}

/** Same as DriveToPoseController.progress: fraction of the start-to-target line covered, by projection. */
export function legProgress(start: Vector, position: Vector, target: Vector) {
  const leg = { x: target.x - start.x, y: target.y - start.y };
  const lengthSquared = leg.x * leg.x + leg.y * leg.y;
  if (lengthSquared < 1e-12) return 1;
  return Math.min(1, Math.max(0, ((position.x - start.x) * leg.x + (position.y - start.y) * leg.y) / lengthSquared));
}

export function legAtGoal(position: Vector, velocity: Vector, target: Vector, limits: LegConstraints) {
  return Math.hypot(target.x - position.x, target.y - position.y) <= limits.endDistanceTolerance
    && length(velocity) <= limits.endVelocityTolerance;
}

/** Runs one leg with ideal tracking, the same loop as DriveToPoseControllerTest. */
export function simulateLeg(start: Vector, velocity: Vector, target: Vector, limits: LegConstraints,
  onCycle?: (position: Vector, velocity: Vector) => void) {
  let position = start;
  let cycles = 0;
  const maxCycles = Math.round(legTimeoutSeconds / loopPeriodSeconds);
  while (!legAtGoal(position, velocity, target, limits)) {
    if (cycles >= maxCycles) return { position, velocity, cycles, finished: false };
    velocity = legCommand(position, target, velocity, limits);
    position = { x: position.x + velocity.x * loopPeriodSeconds, y: position.y + velocity.y * loopPeriodSeconds };
    cycles++;
    onCycle?.(position, velocity);
  }
  return { position, velocity, cycles, finished: true };
}

function turnToward(heading: number, target: number) {
  const step = replayTurnRateDegreesPerSecond * loopPeriodSeconds;
  const error = normalizeHeading(target - heading);
  return Math.abs(error) <= step ? target : normalizeHeading(heading + Math.sign(error) * step);
}

/**
 * Replays the auto from its first drive point. Every command takes at least one robot cycle;
 * consecutive drive legs carry velocity, while any other step leaves the robot stopped.
 */
export function replayAuto(auto: AutoRoutine): Replay {
  const frames: ReplayFrame[] = [];
  const segments: ReplaySegment[] = [];
  const stateChanges: StateChange[] = [];
  const unfinishedStepIds: string[] = [];
  const first = auto.steps.find(step => step.type === "drive");
  if (!first) return { frames, segments, stateChanges, duration: 0, unfinishedStepIds };
  let position: Vector = { x: first.x, y: first.y };
  let velocity: Vector = { x: 0, y: 0 };
  let heading = first.heading;
  let targetHeading = heading;
  let t = 0;
  let state: string | null = null;
  const record = (stepIndex: number) => frames.push({ t, x: position.x, y: position.y, heading, speed: length(velocity), stepIndex });
  const hold = (stepIndex: number, seconds: number) => {
    const cycles = Math.max(1, Math.round(seconds / loopPeriodSeconds));
    for (let i = 0; i < cycles; i++) { t += loopPeriodSeconds; heading = turnToward(heading, targetHeading); record(stepIndex); }
  };
  record(0);

  auto.steps.forEach((step, stepIndex) => {
    const start = t;
    if (step.type === "drive") {
      targetHeading = step.heading;
      // Subpoints run like DriveToPose: once progress reaches them, and any left when the leg ends.
      const legStart = position;
      const subpoints = orderedSubpoints(step);
      let nextSubpoint = 0;
      const runSubpoints = (progress: number) => {
        while (nextSubpoint < subpoints.length && subpoints[nextSubpoint].progress <= progress) {
          const subpoint = subpoints[nextSubpoint++];
          state = subpoint.state;
          stateChanges.push({ t, state, stepId: step.id, subpointId: subpoint.id });
        }
      };
      runSubpoints(legProgress(legStart, position, step));
      const result = simulateLeg(position, velocity, step, legConstraints(step), (next, nextVelocity) => {
        position = next;
        velocity = nextVelocity;
        t += loopPeriodSeconds;
        heading = turnToward(heading, targetHeading);
        record(stepIndex);
        runSubpoints(legProgress(legStart, position, step));
      });
      if (!result.finished) unfinishedStepIds.push(step.id);
      if (result.cycles === 0) hold(stepIndex, 0);
      if (result.finished) runSubpoints(1);
      if (auto.steps[stepIndex + 1]?.type !== "drive") velocity = { x: 0, y: 0 };
    } else {
      velocity = { x: 0, y: 0 };
      if (step.type === "requestState") {
        state = step.state;
        stateChanges.push({ t, state, stepId: step.id });
      }
      const seconds = step.type === "wait" ? step.seconds
        : step.type === "waitForState" ? Math.min(step.replaySeconds, step.timeoutSeconds ?? Number.POSITIVE_INFINITY) : 0;
      hold(stepIndex, Number.isFinite(seconds) ? seconds : 0);
    }
    segments.push({ stepId: step.id, stepIndex, type: step.type, start, end: t, state });
  });
  if (auto.clearRequestsAtEnd && requestsStates(auto)) {
    const start = t;
    stateChanges.push({ t, state: null, stepId: "clear" });
    hold(auto.steps.length - 1, 0);
    segments.push({ stepId: "clear", stepIndex: auto.steps.length, type: "clearRequests", start, end: t, state: null });
  }
  return { frames, segments, stateChanges, duration: t, unfinishedStepIds };
}

/** The requested state at time t. */
export function stateAt(replay: Replay, t: number) {
  let state: string | null = null;
  for (const change of replay.stateChanges) {
    if (change.t > t) break;
    state = change.state;
  }
  return state;
}

/** The frame at time t (frames are one robot cycle apart). */
export function frameAt(replay: Replay, t: number) {
  if (replay.frames.length === 0) return undefined;
  const index = Math.min(replay.frames.length - 1, Math.max(0, Math.round(t / loopPeriodSeconds)));
  return replay.frames[index];
}

export function segmentAt(replay: Replay, t: number) {
  return replay.segments.find(segment => t >= segment.start && t < segment.end) ?? replay.segments.at(-1);
}
