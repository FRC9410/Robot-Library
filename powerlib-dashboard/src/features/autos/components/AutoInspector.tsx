import { Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { AutoStep } from "../autoModel";
import { AutoNumberField } from "./AutoNumberField";

type AutoInspectorProps = { step: AutoStep; states: string[]; disabled: boolean; onChange: (step: AutoStep) => void };

function OptionalState({ label, value, states, disabled, onChange }: { label: string; value: string | null; states: string[]; disabled: boolean; onChange: (value: string | null) => void }) {
  return <TextField select label={label} value={value ?? ""} size="small" disabled={disabled} onChange={event => onChange(event.target.value || null)}>
    <MenuItem value="">None</MenuItem>
    {value && !states.includes(value) && <MenuItem value={value}>{value}</MenuItem>}
    {states.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
  </TextField>;
}

export function AutoInspector({ step, states, disabled, onChange }: AutoInspectorProps) {
  return <Stack spacing={2} aria-label="Step settings" key={step.id}>
    <Typography variant="subtitle1">Step settings</Typography>
    {step.type === "drive" && <>
      <Stack direction="row" spacing={1}>
        <AutoNumberField label="X (m)" value={step.x} disabled={disabled} onChange={x => onChange({ ...step, x })} />
        <AutoNumberField label="Y (m)" value={step.y} disabled={disabled} onChange={y => onChange({ ...step, y })} />
      </Stack>
      <AutoNumberField label="Heading (deg)" value={step.heading} disabled={disabled} onChange={heading => onChange({ ...step, heading })} />
      <OptionalState label="Execute state" value={step.executeState} states={states} disabled={disabled} onChange={executeState => onChange({ ...step, executeState })} />
      <OptionalState label="Wait for state" value={step.waitForState} states={states} disabled={disabled} onChange={waitForState => onChange({ ...step, waitForState })} />
      <AutoNumberField label="Max velocity (m/s)" value={step.maxVelocity} disabled={disabled} min={0.001} onChange={maxVelocity => onChange({ ...step, maxVelocity })} />
      <AutoNumberField label="Max acceleration (m/s²)" value={step.maxAcceleration} disabled={disabled} min={0.001} onChange={maxAcceleration => onChange({ ...step, maxAcceleration })} />
      <AutoNumberField label="End distance tolerance (m)" value={step.endDistanceTolerance} disabled={disabled} min={0.001} onChange={endDistanceTolerance => onChange({ ...step, endDistanceTolerance })} />
      <AutoNumberField label="End velocity tolerance (m/s)" value={step.endVelocityTolerance} disabled={disabled} min={0.001} onChange={endVelocityTolerance => onChange({ ...step, endVelocityTolerance })} />
      <FormControlLabel label="Wait for heading" control={<Checkbox disabled={disabled} checked={step.endHeadingTolerance !== null}
        onChange={(_, checked) => onChange({ ...step, endHeadingTolerance: checked ? 10 : null })} />} />
      {step.endHeadingTolerance !== null && <AutoNumberField label="End heading tolerance (deg)" value={step.endHeadingTolerance}
        disabled={disabled} min={0.001} max={180} onChange={endHeadingTolerance => onChange({ ...step, endHeadingTolerance })} />}
    </>}
    {(step.type === "requestState" || step.type === "waitForState") && <>
      <TextField select label="State action" value={step.type} size="small" disabled={disabled} onChange={event => {
        if (event.target.value === "waitForState") onChange({ ...step, type: "waitForState",
          timeoutSeconds: null,
          replaySeconds: "replaySeconds" in step ? step.replaySeconds : 0.5 });
        else onChange({ ...step, type: "requestState" });
      }}>
        <MenuItem value="requestState">Execute state</MenuItem>
        <MenuItem value="waitForState">Wait for state</MenuItem>
      </TextField>
      <TextField select label="Robot state" value={step.state} size="small" disabled={disabled}
      onChange={event => onChange({ ...step, state: event.target.value })}>
      {!states.includes(step.state) && <MenuItem value={step.state}>{step.state || "Choose a state"}</MenuItem>}
      {states.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
      </TextField>
    </>}
    {step.type === "wait" && <AutoNumberField label="Wait (s)" value={step.seconds} min={0} disabled={disabled} onChange={seconds => onChange({ ...step, seconds })} />}
  </Stack>;
}
