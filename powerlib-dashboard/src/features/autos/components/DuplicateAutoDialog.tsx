import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import { uniqueAutoCopyName } from "../autoEditing";
import type { AutoRoutine, Symmetry } from "../autoModel";

export function DuplicateAutoDialog({ auto, names, disabled, onClose, onDuplicate }: { auto: AutoRoutine; names: string[]; disabled: boolean;
  onClose: () => void; onDuplicate: (name: string, reflection: Symmetry) => void }) {
  const [name, setName] = useState(() => uniqueAutoCopyName(auto, names));
  const [axis, setAxis] = useState("none");
  const trimmed = name.trim(), conflict = names.some(name => name.trim() === trimmed);
  const invalid = !trimmed || trimmed === "None" || conflict || /[\x00-\x1f\x7f]/.test(trimmed);
  return <Dialog open onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>Duplicate auto</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <TextField label="New auto name" size="small" value={name} disabled={disabled} autoFocus error={invalid} slotProps={{ htmlInput: { maxLength: 100 } }}
        helperText={conflict ? "This name is already used." : trimmed === "None" ? "None is reserved." : undefined} onChange={event => setName(event.target.value)} />
      <TextField select label="Mirror axis" size="small" value={axis} disabled={disabled} onChange={event => setAxis(event.target.value)}>
        <MenuItem value="none">None — exact copy</MenuItem><MenuItem value="x">X — field length</MenuItem>
        <MenuItem value="y">Y — field width</MenuItem><MenuItem value="both">X and Y</MenuItem>
      </TextField>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={disabled || invalid}
      onClick={() => onDuplicate(trimmed, { flipX: axis === "x" || axis === "both", flipY: axis === "y" || axis === "both" })}>Duplicate</Button></DialogActions>
  </Dialog>;
}
