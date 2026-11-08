import { Button, Checkbox, FormControlLabel, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { createId, type DriveStep, type NamedPoint } from "../autoModel";
import { AutoNumberField } from "./AutoNumberField";

export function AdvancedDriveSettings({ step, states, points, disabled, onChange }: {
  step: DriveStep; states: string[]; points: NamedPoint[]; disabled: boolean; onChange: (step: DriveStep) => void;
}) {
  const facing = step.turn.mode === "face" ? step.turn : null;
  return <>
    <TextField select label="Turning" size="small" value={step.turn.mode} disabled={disabled} onChange={event => onChange({ ...step,
      turn: event.target.value === "later" ? { mode: "later", startProgress: .5 }
        : event.target.value === "face" ? { mode: "face", x: step.x + 1, y: step.y, pointId: null } : { mode: "now" } })}>
      <MenuItem value="now">Turn now</MenuItem><MenuItem value="later">Turn later</MenuItem><MenuItem value="face">Face point</MenuItem>
    </TextField>
    {step.turn.mode === "later" && <AutoNumberField label="Start turning (% of leg)" value={step.turn.startProgress * 100} min={0} max={100} disabled={disabled}
      onChange={value => onChange({ ...step, turn: { mode: "later", startProgress: value / 100 } })} />}
    {facing && <>
      <TextField select label="Face named point" size="small" value={facing.pointId ?? ""} disabled={disabled} onChange={event => {
        const point = points.find(point => point.id === event.target.value);
        onChange({ ...step, turn: point ? { mode: "face", x: point.x, y: point.y, pointId: point.id } : { ...facing, pointId: null } });
      }}><MenuItem value="">Field coordinates</MenuItem>{points.map(point => <MenuItem key={point.id} value={point.id}>{point.name}</MenuItem>)}</TextField>
      <Stack direction="row" spacing={1}>
        <AutoNumberField label="Face X (m)" value={facing.x} disabled={disabled} onChange={x => onChange({ ...step, turn: { ...facing, x, pointId: null } })} />
        <AutoNumberField label="Face Y (m)" value={facing.y} disabled={disabled} onChange={y => onChange({ ...step, turn: { ...facing, y, pointId: null } })} />
      </Stack>
    </>}
    <FormControlLabel label="Limit turn rate" control={<Checkbox disabled={disabled} checked={step.maxTurnRate !== null}
      onChange={(_, checked) => onChange({ ...step, maxTurnRate: checked ? 180 : null })} />} />
    {step.maxTurnRate !== null && <AutoNumberField label="Max turn rate (deg/s)" value={step.maxTurnRate} min={.001} disabled={disabled}
      onChange={maxTurnRate => onChange({ ...step, maxTurnRate })} />}
    <Typography variant="subtitle2">During this move</Typography>
    {step.subpoints.map((subpoint, index) => <Stack key={subpoint.id} spacing={1} data-subpoint-id={subpoint.id}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <AutoNumberField label={`State change ${index + 1} (% of leg)`} value={subpoint.progress * 100} min={0} max={100} disabled={disabled}
          onChange={value => onChange({ ...step, subpoints: step.subpoints.map(item => item.id === subpoint.id ? { ...item, progress: value / 100 } : item) })} />
        <IconButton aria-label={`Delete state change ${index + 1}`} disabled={disabled} size="small"
          onClick={() => onChange({ ...step, subpoints: step.subpoints.filter(item => item.id !== subpoint.id) })}><DeleteOutlinedIcon fontSize="small" /></IconButton>
      </Stack>
      <TextField select label={`State change ${index + 1} state`} value={subpoint.state} size="small" disabled={disabled}
        onChange={event => onChange({ ...step, subpoints: step.subpoints.map(item => item.id === subpoint.id ? { ...item, state: event.target.value } : item) })}>
        {!states.includes(subpoint.state) && <MenuItem value={subpoint.state}>{subpoint.state || "Choose a state"}</MenuItem>}
        {states.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
      </TextField>
    </Stack>)}
    <Button size="small" disabled={disabled || !states.length} onClick={() => onChange({ ...step,
      subpoints: [...step.subpoints, { id: createId(), progress: .5, state: states[0] }] })}>Add state change</Button>
  </>;
}
