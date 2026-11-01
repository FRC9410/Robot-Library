// Ideal-motion replay of an auto: the robot moves exactly as commanded, using the same math as
// frc.powerlib.auto.DriveToPoseController. Keep the two in sync.
import type { AutoRoutine, AutoStep, BranchChoices, LegConstraints } from "./autoModel";
import { branchWaitSeconds, defaultTurnRate, joiningRequests, legConstraints, legEndHeading, normalizeHeading, orderedSubpoints, requestsStates, routeSteps } from "./autoModel";

export const loopPeriodSeconds = 0.02;
export const positionGain = 4.0;
/** Matches the default SwerveConstants.DRIVE_TO_POINT_MAX_ANGULAR_RATE_RADIANS_PER_SECOND (π rad/s). */
export const replayTurnRateDegreesPerSecond = defaultTurnRate;
/** A leg that has not finished after this long is reported and the replay moves on. */
export const legTimeoutSeconds = 10;

type Vector = { x: number; y: number };
/** What held the robot back in a cycle: its top speed, its acceleration, or wheel speed used up by turning. */
export type RobotLimit = "speed" | "acceleration" | "turn";
/**
 * A drivetrain that can't always do what it is commanded (see autoLimits.ts). Given the commanded
 * velocity, the velocity it has now, its heading and the turn rate it is asked for (degrees per
 * second), it returns the velocity and turn rate it actually reaches this cycle.
 */
export type RobotModel = {
  follow: (command: Vector, actual: Vector, heading: number, turnRate: number) => { velocity: Vector; turnRate: number; limit: RobotLimit | null };
};
/** `limit` is set when a robot model held the robot back in that cycle. */
export type ReplayFrame = { t: number; x: number; y: number; heading: number; speed: number; stepIndex: number; limit?: RobotLimit };
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

/**
 * Runs one leg, the same loop as DriveToPoseControllerTest. With ideal tracking the robot moves at
 * the commanded velocity; `follow` instead gives the velocity a real drivetrain reaches.
 */
export function simulateLeg(start: Vector, velocity: Vector, target: Vector, limits: LegConstraints,
  onCycle?: (position: Vector, velocity: Vector) => void, follow?: (command: Vector, actual: Vector) => Vector) {
  let position = start;
  // Like DriveToPoseController.reset(): the command starts from the measured velocity.
  let command = velocity;
  let cycles = 0;
  const maxCycles = Math.round(legTimeoutSeconds / loopPeriodSeconds);
  while (!legAtGoal(position, velocity, target, limits)) {
    if (cycles >= maxCycles) return { position, velocity, cycles, finished: false };
    command = legCommand(position, target, command, limits);
    velocity = follow ? follow(command, velocity) : command;
    position = { x: position.x + velocity.x * loopPeriodSeconds, y: position.y + velocity.y * loopPeriodSeconds };
    cycles++;
    onCycle?.(position, velocity);
  }
  return { position, velocity, cycles, finished: true };
}

function turnToward(heading: number, target: number, degreesPerSecond: number) {
  const step = degreesPerSecond * loopPeriodSeconds;
  const error = normalizeHeading(target - heading);
  return Math.abs(error) <= step ? target : normalizeHeading(heading + Math.sign(error) * step);
}

/** The signed turn rate (degrees per second) turnToward uses this cycle. */
function turnRateToward(heading: number, target: number, degreesPerSecond: number) {
  const error = normalizeHeading(target - heading);
  return Math.sign(error) * Math.min(degreesPerSecond, Math.abs(error) / loopPeriodSeconds);
}

/**
 * Replays the auto from its first drive point, taking the side of each branch that `choices`
 * picks (Then by default). Every command takes at least one robot cycle; consecutive drive legs
 * carry velocity, and so do state requests between them (they join the next move) and branches
 * that go straight into a move; waits leave the robot stopped. With a `robot` model, drive legs
 * move as that drivetrain can instead of exactly as commanded.
 */
export function replayAuto(auto: AutoRoutine, choices: BranchChoices = {}, robot?: RobotModel): Replay {
  const frames: ReplayFrame[] = [];
  const segments: ReplaySegment[] = [];
  const stateChanges: StateChange[] = [];
  const unfinishedStepIds: string[] = [];
  const steps = routeSteps(auto.steps, choices);
  const joins = joiningRequests(auto.steps);
  // Commands.either starts its side the moment it starts, so a branch that doesn't wait first and
  // has steps on the taken side takes no time of its own.
  const passesThrough = (step: AutoStep | undefined) => step?.type === "branch" && branchWaitSeconds(step) === 0
    && step[choices[step.id] ?? "then"].length > 0;
  const nextCommand = (index: number) => {
    let next = index + 1;
    while (passesThrough(steps[next])) next++;
    return steps[next];
  };
  const first = steps.find(step => step.type === "drive");
  if (!first) return { frames, segments, stateChanges, duration: 0, unfinishedStepIds };
  let position: Vector = { x: first.x, y: first.y };
  let velocity: Vector = { x: 0, y: 0 };
  let heading = legEndHeading(first);
  let targetHeading = heading;
  let turnRate = replayTurnRateDegreesPerSecond;
  let t = 0;
  let state: string | null = null;
  const record = (stepIndex: number, limit?: RobotLimit | null) =>
    frames.push({ t, x: position.x, y: position.y, heading, speed: length(velocity), stepIndex, ...(limit ? { limit } : {}) });
  const hold = (stepIndex: number, seconds: number) => {
    const cycles = Math.max(1, Math.round(seconds / loopPeriodSeconds));
    for (let i = 0; i < cycles; i++) { t += loopPeriodSeconds; heading = turnToward(heading, targetHeading, turnRate); record(stepIndex); }
  };
  record(0);

  steps.forEach((step, stepIndex) => {
    const start = t;
    if (step.type === "drive") {
      turnRate = step.maxTurnRate ?? replayTurnRateDegreesPerSecond;
      // The heading to hold, like LegHeading.target(): face the point, or wait for the turn to start.
      const legStartHeading = heading;
      let facing: number | null = null;
      const desiredHeading = (progress: number) => {
        if (step.turn.mode === "face") {
          const dx = step.turn.x - position.x;
          const dy = step.turn.y - position.y;
          if (Math.hypot(dx, dy) > 1e-3) facing = Math.atan2(dy, dx) * 180 / Math.PI;
          return facing ?? step.heading;
        }
        return step.turn.mode === "later" && progress < step.turn.startProgress ? legStartHeading : step.heading;
      };
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
      targetHeading = desiredHeading(legProgress(legStart, position, step));
      // A robot model turns at the rate it can manage this cycle, toward last cycle's target heading.
      let followed: ReturnType<RobotModel["follow"]> | null = null;
      const follow = robot && ((command: Vector, actual: Vector) => {
        followed = robot.follow(command, actual, heading, turnRateToward(heading, targetHeading, turnRate));
        return followed.velocity;
      });
      const result = simulateLeg(position, velocity, step, legConstraints(step), (next, nextVelocity) => {
        position = next;
        velocity = nextVelocity;
        t += loopPeriodSeconds;
        const turned: ReturnType<RobotModel["follow"]> | null = followed;
        if (turned) heading = normalizeHeading(heading + turned.turnRate * loopPeriodSeconds);
        targetHeading = desiredHeading(legProgress(legStart, position, step));
        if (!turned) heading = turnToward(heading, targetHeading, turnRate);
        record(stepIndex, turned?.limit);
        runSubpoints(legProgress(legStart, position, step));
      }, follow);
      if (!result.finished) unfinishedStepIds.push(step.id);
      if (result.cycles === 0) hold(stepIndex, 0);
      if (result.finished) runSubpoints(1);
      // Motion carries into the next move, including across requests that join it.
      const next = nextCommand(stepIndex);
      if (next?.type !== "drive" && !(next && joins.has(next.id))) velocity = { x: 0, y: 0 };
    } else if (step.type === "branch") {
      if (!passesThrough(step)) {
        // Waiting for the condition: the replay assumes it is already true on the Then side and
        // never comes on the Otherwise side. An empty side still takes a cycle.
        velocity = { x: 0, y: 0 };
        hold(stepIndex, (choices[step.id] ?? "then") === "otherwise" ? branchWaitSeconds(step) : 0);
      }
    } else if (joins.has(step.id)) {
      // Made as the next move starts (DriveToPose.atProgress(0)), so no cycle passes and the robot keeps moving.
      state = (step as Extract<AutoStep, { type: "requestState" }>).state;
      stateChanges.push({ t, state, stepId: step.id });
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
    hold(steps.length - 1, 0);
    segments.push({ stepId: "clear", stepIndex: steps.length, type: "clearRequests", start, end: t, state: null });
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
