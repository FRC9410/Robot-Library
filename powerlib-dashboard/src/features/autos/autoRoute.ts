// The route the field shows: one run through the auto, each branch followed by the side picked for it.
import type { AutoStep, BranchChoices, DriveStep, InsertTarget } from "./autoModel";
import { allSteps, routeSteps } from "./autoModel";
import type { GhostRoute } from "./types";

export const isDrive = (step: AutoStep): step is DriveStep => step.type === "drive";
export const lastDrive = (steps: AutoStep[]) => [...steps].reverse().find(isDrive);

/** The faint routes for the sides of branches the field isn't showing. */
export function branchGhosts(route: AutoStep[], choices: BranchChoices): GhostRoute[] {
  return route.flatMap((step, index) => {
    if (step.type !== "branch") return [];
    const shown = choices[step.id] ?? "then";
    const other = step[shown === "then" ? "otherwise" : "then"];
    const from = lastDrive(route.slice(0, index)) ?? null;
    const to = route.slice(index + 1 + routeSteps(step[shown], choices).length).find(isDrive) ?? null;
    const points = routeSteps(other, choices).filter(isDrive).map(drive => ({ stepId: drive.id, x: drive.x, y: drive.y }));
    return points.length || (from && to) ? [{ from, points, to }] : [];
  });
}

/** The drive just before where new steps go, along the route they'll be on. */
export function driveBefore(steps: AutoStep[], choices: BranchChoices, target: InsertTarget) {
  const preview = "into" in target ? { ...choices, [target.into.branchId]: target.into.arm } : choices;
  const route = routeSteps(steps, preview);
  const anchor = "into" in target ? target.into.branchId : target.after;
  const at = anchor === null ? -1 : route.findIndex(step => step.id === anchor);
  if (at < 0) return lastDrive(route);
  // After a branch (or at the end of one of its sides), the robot comes from the end of the side it took.
  const anchored = route[at];
  const end = anchored.type === "branch" ? at + 1 + routeSteps(anchored[preview[anchored.id] ?? "then"], preview).length : at + 1;
  return lastDrive(route.slice(0, end));
}

/** Step numbers in the step list, and point numbers over every drive step (both sides of each branch). */
export function stepNumbering(steps: AutoStep[]) {
  const ordered = allSteps(steps);
  return {
    stepNumbers: new Map(ordered.map((step, index) => [step.id, index + 1])),
    driveNumbers: new Map(ordered.filter(isDrive).map((step, index) => [step.id, index + 1]))
  };
}

/** The steps with these ids, in run order. */
export const stepsInOrder = (steps: AutoStep[], stepIds: string[]) => allSteps(steps).filter(step => stepIds.includes(step.id));

/** New steps go after the selected step (the last one, in run order) so an auto is built in order. */
export const insertTargetAfter = (steps: AutoStep[], selection: string[]): InsertTarget =>
  ({ after: [...allSteps(steps)].reverse().find(step => selection.includes(step.id))?.id ?? null });
