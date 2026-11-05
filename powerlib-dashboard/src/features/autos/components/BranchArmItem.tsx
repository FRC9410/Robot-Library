import type { DragEvent } from "react";
import { IconButton, Tooltip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { BranchArm } from "../autoModel";
import { armLabels } from "../stepText";

type BranchArmItemProps = {
  arm: BranchArm;
  empty: boolean;
  /** The field isn't showing this side. */
  offRoute: boolean;
  /** Dragged steps would drop into this (empty) side. */
  dropInto: boolean;
  onShow: () => void;
  onAdd: (anchor: HTMLElement) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
};

/** The label above one side of a branch in the step list; click it to show that side on the field. */
export function BranchArmItem({ arm, empty, offRoute, dropInto, onShow, onAdd, onDragOver }: BranchArmItemProps) {
  return <li className={`ab-arm${offRoute ? " off-route" : ""}${dropInto ? " drop-into" : ""}`}
    title={offRoute ? "Click to show this side on the field" : "Shown on the field"} onDragOver={onDragOver} onClick={onShow}>
    <span>{armLabels[arm]}</span>
    {empty && <span className="ab-arm-empty">nothing, carry on</span>}
    <Tooltip title={`Add a step to ${armLabels[arm]}`}>
      <IconButton size="small" aria-label={`Add a step to ${armLabels[arm]}`} onClick={event => { event.stopPropagation(); onAdd(event.currentTarget); }}>
        <AddIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  </li>;
}
