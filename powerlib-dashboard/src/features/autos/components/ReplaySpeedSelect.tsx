import { MenuItem, TextField, Tooltip } from "@mui/material";

const speeds = [0.25, 0.5, 1, 2];

type ReplaySpeedSelectProps = {
  value: number;
  onChange: (speed: number) => void;
};

/** How fast the replay plays: quiet text with a dropdown, at the end of the replay bar. */
export function ReplaySpeedSelect({ value, onChange }: ReplaySpeedSelectProps) {
  return <Tooltip title="Replay speed" placement="top">
    <TextField select variant="standard" value={value} onChange={event => onChange(Number(event.target.value))}
      slotProps={{ input: { disableUnderline: true }, htmlInput: { "aria-label": "Replay speed" },
        select: { sx: { py: 0.25, pl: 0.75, fontSize: 13, fontVariantNumeric: "tabular-nums", color: "text.secondary", borderRadius: 1,
          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.06)" } } } }}>
      {speeds.map(speed => <MenuItem key={speed} value={speed}>{speed}×</MenuItem>)}
    </TextField>
  </Tooltip>;
}
