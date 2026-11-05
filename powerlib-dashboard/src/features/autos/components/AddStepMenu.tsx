import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import type { AutoStepType } from "../autoModel";
import { stepLabels } from "../autoModel";
import { stepDescriptions } from "../stepText";
import { StepIcon } from "./StepIcon";

type AddStepMenuProps = {
  anchor: HTMLElement | null;
  /** Adding into one side of a branch; branches can't hold branches, so it doesn't offer one. */
  intoBranch: boolean;
  onAdd: (type: AutoStepType) => void;
  onClose: () => void;
};

/** The kinds of step, with what each does. */
export function AddStepMenu({ anchor, intoBranch, onAdd, onClose }: AddStepMenuProps) {
  const types = (Object.keys(stepLabels) as AutoStepType[]).filter(type => !(intoBranch && type === "branch"));
  return <Menu anchorEl={anchor} open={anchor !== null} onClose={onClose}>
    {types.map(type => <MenuItem key={type} onClick={() => { onAdd(type); onClose(); }}>
      <ListItemIcon><StepIcon type={type} /></ListItemIcon>
      <ListItemText primary={stepLabels[type]} secondary={stepDescriptions[type]} />
    </MenuItem>)}
  </Menu>;
}
