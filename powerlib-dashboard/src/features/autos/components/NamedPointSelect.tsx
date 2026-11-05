import type { ReactNode } from "react";
import { MenuItem, TextField } from "@mui/material";
import type { NamedPoint } from "../autoModel";

type NamedPointSelectProps = {
  label: string;
  /** The picked point's id, or null for the empty choice. */
  value: string | null;
  points: NamedPoint[];
  /** What the empty choice says, such as "None". */
  emptyLabel: ReactNode;
  onChange: (pointId: string | null) => void;
};

/** Picks one of the named points shared by every auto. */
export function NamedPointSelect({ label, value, points, emptyLabel, onChange }: NamedPointSelectProps) {
  return <TextField select size="small" label={label} value={value ?? ""} fullWidth
    slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
    onChange={event => onChange(event.target.value || null)}>
    <MenuItem value="">{emptyLabel}</MenuItem>
    {points.map(point => <MenuItem key={point.id} value={point.id}>{point.name}</MenuItem>)}
  </TextField>;
}
