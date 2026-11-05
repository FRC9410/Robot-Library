import { Button, TextField, Tooltip, Typography } from "@mui/material";
import AddLocationIcon from "@mui/icons-material/AddLocationAlt";
import PlaceIcon from "@mui/icons-material/Place";
import type { NamedPoint } from "../autoModel";
import { fieldColors } from "../fieldGeometry";
import { FieldRow } from "./FieldRow";
import { NamedPointSelect } from "./NamedPointSelect";
import { TooltipIconButton } from "./TooltipIconButton";

type NamedPointLinkProps = {
  /** The point the step is linked to, if any. */
  linked?: NamedPoint;
  points: NamedPoint[];
  /** Links the step to a point, or unlinks it with null. */
  onLink: (pointId: string | null) => void;
  /** Saves the step's pose as a new named point and links the step to it. */
  onSave: () => void;
  onRename: (name: string) => void;
};

/** A drive step's named point: rename or unlink it, pick one to link, or save the pose as a new one. */
export function NamedPointLink({ linked, points, onLink, onSave, onRename }: NamedPointLinkProps) {
  if (linked) return <FieldRow center>
    <Tooltip title="Moving this step moves the point in every auto that uses it">
      <TextField size="small" label="Named point" value={linked.name} sx={{ flex: 1 }} onChange={event => onRename(event.target.value)}
        slotProps={{ input: { startAdornment: <PlaceIcon fontSize="small" sx={{ color: fieldColors.namedPoint, mr: 0.5 }} /> } }} />
    </Tooltip>
    <Button size="small" onClick={() => onLink(null)}>Unlink</Button>
  </FieldRow>;
  if (points.length === 0) return <Button size="small" startIcon={<AddLocationIcon />} onClick={onSave} sx={{ alignSelf: "flex-start" }}>
    Save as named point
  </Button>;
  return <FieldRow center>
    <NamedPointSelect label="Named point" value={null} points={points} onChange={onLink}
      emptyLabel={<Typography color="text.secondary" variant="inherit">None</Typography>} />
    <TooltipIconButton title="Save this pose as a new named point" label="Save as named point" size="medium" onClick={onSave}>
      <AddLocationIcon />
    </TooltipIconButton>
  </FieldRow>;
}
