import type { DragEvent } from "react";
import { IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import type { AutoIssue, AutoStep } from "../autoModel";
import { format, stepSummary, stepTitle } from "../stepText";
import { StepIcon } from "./StepIcon";

type StepListItemProps = {
  step: AutoStep;
  number: number;
  driveNumber: number;
  /** Inside one side of a branch. */
  nested: boolean;
  /** On the side of a branch the field isn't showing. */
  offRoute: boolean;
  selected: boolean;
  /** The step the replay is running. */
  active: boolean;
  issues: AutoIssue[];
  /** The state color for state steps. */
  accent?: string;
  /** Replay seconds; left out for steps that take no time. */
  duration?: number;
  dropAbove: boolean;
  dropBelow: boolean;
  /** `toggle` adds or removes the step from the selection (Shift- or Ctrl-click). */
  onSelect: (toggle: boolean) => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
};

/** One step in the step list: number, icon, title and summary (or its first problem), time, and delete on hover. */
export function StepListItem({ step, number, driveNumber, nested, offRoute, selected, active, issues, accent, duration, dropAbove, dropBelow,
  onSelect, onDelete, onDragStart, onDragOver, onDragEnd }: StepListItemProps) {
  const severity = issues.some(issue => issue.severity === "error") ? "error" : issues.length ? "warning" : null;
  const classes = ["ab-step", nested && "nested", step.type === "branch" && "branch", offRoute && "off-route", selected && "selected",
    active && "active", severity, dropAbove && "drop-above", dropBelow && "drop-below"];
  return <li data-step-id={step.id} className={classes.filter(Boolean).join(" ")} draggable
    onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
    style={accent ? { borderLeftColor: accent } : undefined}
    onClick={event => onSelect(event.shiftKey || event.ctrlKey || event.metaKey)}>
    <span className="ab-step-index">{number}</span>
    <span className="ab-step-icon" style={accent ? { color: accent } : undefined}><StepIcon type={step.type} /></span>
    <span className="ab-step-text">
      <span className="ab-step-title">{stepTitle(step, driveNumber)}</span>
      <span className="ab-step-summary">{severity ? issues[0].message : stepSummary(step)}</span>
    </span>
    {duration !== undefined && <span className="ab-step-time">{format(duration, 1)} s</span>}
    <span className="ab-step-actions" onClick={event => event.stopPropagation()}>
      <IconButton size="small" aria-label="Delete step" onClick={onDelete}><DeleteIcon fontSize="inherit" /></IconButton>
    </span>
  </li>;
}
