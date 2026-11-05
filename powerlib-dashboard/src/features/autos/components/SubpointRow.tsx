import { Box, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import type { Subpoint } from "../autoModel";
import { round } from "../autoModel";
import { FieldRow } from "./FieldRow";
import { NumberField } from "./NumberField";
import { StateSelect } from "./StateSelect";

type SubpointRowProps = {
  subpoint: Subpoint;
  states: string[];
  onChange: (patch: Partial<Subpoint>) => void;
  onRemove: () => void;
};

/** A state requested partway along a leg: which state, and how far along. */
export function SubpointRow({ subpoint, states, onChange, onRemove }: SubpointRowProps) {
  return <FieldRow center>
    <StateSelect value={subpoint.state} states={states} label="Request" onChange={state => onChange({ state })} />
    <Box sx={{ width: 110, flexShrink: 0 }}>
      <NumberField label="At" unit="%" value={round(subpoint.progress * 100, 1)} error={!(subpoint.progress >= 0 && subpoint.progress <= 1)}
        onChange={value => onChange({ progress: (value ?? 0) / 100 })} />
    </Box>
    <IconButton size="small" aria-label="Remove state change" onClick={onRemove}><DeleteIcon fontSize="small" /></IconButton>
  </FieldRow>;
}
