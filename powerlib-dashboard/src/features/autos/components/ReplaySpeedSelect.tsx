import { MenuItem, TextField } from "@mui/material";

const speeds = [0.25, 0.5, 1, 2];

type ReplaySpeedSelectProps = {
  value: number;
  onChange: (speed: number) => void;
};

/** How fast the replay plays. */
export function ReplaySpeedSelect({ value, onChange }: ReplaySpeedSelectProps) {
  return <TextField select size="small" value={value} onChange={event => onChange(Number(event.target.value))} aria-label="Replay speed"
    sx={{ width: 76 }} slotProps={{ select: { sx: { py: 0.5 } } }}>
    {speeds.map(speed => <MenuItem key={speed} value={speed}>{speed}×</MenuItem>)}
  </TextField>;
}
