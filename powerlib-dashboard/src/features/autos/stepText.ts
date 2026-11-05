// Words for steps: titles, one-line summaries and descriptions, shared by the step list, inspector and menus.
import type { AutoStep, AutoStepType, BranchArm, BranchCondition } from "./autoModel";
import { branchWaitSeconds, legEndHeading, orderedSubpoints } from "./autoModel";

/** A number with at most `digits` decimals and no trailing zeros; "?" when it isn't a number. */
export const format = (value: number, digits = 2) => Number.isFinite(value) ? String(Number(value.toFixed(digits))) : "?";

export const stepDescriptions: Record<AutoStepType, string> = {
  drive: "Drive to a pose with this leg's speed and finish limits",
  requestState: "Ask the state machine for a state and continue immediately",
  waitForState: "Pause until the state machine reports a state",
  wait: "Pause for a fixed time",
  branch: "Run different steps depending on the robot or the time left"
};

export const armLabels: Record<BranchArm, string> = { then: "Then", otherwise: "Otherwise" };

export const stepCount = (steps: AutoStep[]) => steps.length ? `${steps.length} step${steps.length === 1 ? "" : "s"}` : "nothing";

export function conditionLabel(condition: BranchCondition) {
  switch (condition.kind) {
    case "state": return condition.state || "state";
    case "check": return condition.method ? `${condition.method}()` : "robot check";
    case "timeLeft": return `${format(condition.seconds)} s left`;
  }
}

export function stepTitle(step: AutoStep, driveNumber: number) {
  switch (step.type) {
    case "drive": return `Drive to point ${driveNumber}`;
    case "requestState": return `Request ${step.state || "state"}`;
    case "waitForState": return `Wait for ${step.state || "state"}`;
    case "wait": return `Wait ${format(step.seconds)} s`;
    case "branch": return `If ${conditionLabel(step.condition)}`;
  }
}

export function stepSummary(step: AutoStep) {
  switch (step.type) {
    case "drive": {
      const subpoints = orderedSubpoints(step).map(subpoint => `${subpoint.state || "?"} at ${format(subpoint.progress * 100, 0)}%`);
      return subpoints.length
        ? `${format(step.maxVelocity, 1)} m/s · ${subpoints.join(", ")}`
        : `(${format(step.x)}, ${format(step.y)}) · ${format(legEndHeading(step), 0)}° · ${format(step.maxVelocity, 1)} m/s`;
    }
    case "requestState": return "Continues immediately";
    case "waitForState": return step.timeoutSeconds === null ? "No timeout" : `Timeout ${format(step.timeoutSeconds)} s`;
    case "wait": return "Fixed pause";
    case "branch": {
      const wait = branchWaitSeconds(step);
      return `${wait > 0 ? `Waits up to ${format(wait)} s · ` : ""}Then ${stepCount(step.then)}, otherwise ${stepCount(step.otherwise)}`;
    }
  }
}
