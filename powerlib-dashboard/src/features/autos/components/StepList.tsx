import { useRef } from "react";
import type { AutoIssue, AutoStep, BranchArm, BranchChoices, ListRef } from "../autoModel";
import { stepListRows, listKey } from "../stepListRows";
import { stepAccent } from "../autoView";
import type { BranchSide } from "../types";
import { useKeepStepVisible } from "../useKeepStepVisible";
import { useStepDrag } from "../useStepDrag";
import { BranchArmItem } from "./BranchArmItem";
import { StepListItem } from "./StepListItem";

/** Steps shorter than this show no time, so instant steps don't all read "0 s". */
const shownSeconds = 0.05;

type StepListProps = {
  steps: AutoStep[];
  /** The side of each branch the field shows; steps on the other side are dimmed. */
  choices: BranchChoices;
  selectedStepIds: string[];
  activeStepId: string | null;
  durations: Map<string, number>;
  issues: AutoIssue[];
  stateColor: (state: string | null) => string;
  /** `toggle` adds or removes the step from the selection (Shift- or Ctrl-click). */
  onSelect: (stepId: string, toggle: boolean) => void;
  /** Moves the steps so they sit before the step now at `index` of `list` (its length for the end). */
  onReorder: (stepIds: string[], list: ListRef, index: number) => void;
  onDelete: (stepId: string) => void;
  /** Shows one side of a branch on the field. */
  onShowArm: (branchId: string, arm: BranchArm) => void;
  /** Opens the add-step menu for one side of a branch. */
  onAddTo: (into: BranchSide, anchor: HTMLElement) => void;
};

/** The selected auto's steps in run order, with each branch's sides indented under it. Drag to reorder. */
export function StepList({ steps, choices, selectedStepIds, activeStepId, durations, issues, stateColor, onSelect, onReorder, onDelete,
  onShowArm, onAddTo }: StepListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useStepDrag(steps, selectedStepIds, onReorder);
  useKeepStepVisible(listRef, selectedStepIds[selectedStepIds.length - 1]);

  return <ol className="ab-steps" ref={listRef} {...drag.listHandlers}>
    {stepListRows(steps, choices).map(row => {
      if (row.kind === "arm") {
        const into = { branchId: row.branch.id, arm: row.arm };
        const empty = row.branch[row.arm].length === 0;
        return <BranchArmItem key={listKey(into)} arm={row.arm} empty={empty} offRoute={row.offRoute} dropInto={empty && drag.isDrop(into, 0)}
          onShow={() => onShowArm(row.branch.id, row.arm)} onAdd={anchor => onAddTo(into, anchor)} onDragOver={event => drag.offer(event, into, 0)} />;
      }
      const { step } = row;
      const seconds = durations.get(step.id);
      return <StepListItem key={step.id} step={step} number={row.number} driveNumber={row.driveNumber} nested={row.list !== null}
        offRoute={row.offRoute} selected={selectedStepIds.includes(step.id)} active={step.id === activeStepId}
        issues={issues.filter(issue => issue.stepId === step.id)} accent={stepAccent(step, stateColor)}
        duration={seconds !== undefined && seconds >= shownSeconds ? seconds : undefined}
        dropAbove={drag.isDrop(row.list, row.index)} dropBelow={row.list !== null && row.last && drag.isDrop(row.list, row.index + 1)}
        onSelect={toggle => onSelect(step.id, toggle)} onDelete={() => onDelete(step.id)}
        onDragStart={event => drag.start(event, step.id)} onDragEnd={drag.end}
        onDragOver={event => {
          const box = event.currentTarget.getBoundingClientRect();
          const lower = event.clientY >= box.top + box.height / 2;
          // The lower half of a branch drops into its Then side, which comes right after it.
          if (step.type === "branch" && lower) drag.offer(event, { branchId: step.id, arm: "then" }, 0);
          else drag.offer(event, row.list, row.index + (lower ? 1 : 0));
        }} />;
    })}
    <li className={`ab-steps-end${drag.isDrop(null, steps.length) ? " drop-here" : ""}`} onDragOver={event => drag.offer(event, null, steps.length)} />
  </ol>;
}
