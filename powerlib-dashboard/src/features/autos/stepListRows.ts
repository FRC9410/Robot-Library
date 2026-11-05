// The step list's rows in run order: each branch's steps sit under a label for their side.
import type { AutoStep, BranchArm, BranchChoices, BranchStep, ListRef } from "./autoModel";

export type StepListRow =
  | { kind: "step"; step: AutoStep; list: ListRef; index: number; last: boolean; number: number; driveNumber: number; offRoute: boolean }
  | { kind: "arm"; branch: BranchStep; arm: BranchArm; offRoute: boolean };

/** A stable key for a list of steps: the auto's own list or one side of a branch. */
export const listKey = (list: ListRef) => list ? `${list.branchId}:${list.arm}` : "";

/** `offRoute` marks rows on the side of a branch the field isn't showing. */
export function stepListRows(steps: AutoStep[], choices: BranchChoices) {
  const rows: StepListRow[] = [];
  let number = 0;
  let driveNumber = 0;
  const visit = (list: AutoStep[], ref: ListRef, offRoute: boolean) => list.forEach((step, index) => {
    if (step.type === "drive") driveNumber++;
    rows.push({ kind: "step", step, list: ref, index, last: index === list.length - 1, number: ++number, driveNumber, offRoute });
    if (step.type !== "branch") return;
    for (const arm of ["then", "otherwise"] as const) {
      const hidden = offRoute || (choices[step.id] ?? "then") !== arm;
      rows.push({ kind: "arm", branch: step, arm, offRoute: hidden });
      visit(step[arm], { branchId: step.id, arm }, hidden);
    }
  });
  visit(steps, null, false);
  return rows;
}
