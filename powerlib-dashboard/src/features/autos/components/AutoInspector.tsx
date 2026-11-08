import { Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { AutoStep, NamedPoint } from "../autoModel";
import { AutoNumberField } from "./AutoNumberField";
import { AdvancedDriveSettings } from "./AdvancedDriveSettings";
import { BranchConditionSettings } from "./BranchConditionSettings";

type AutoInspectorProps = { step: AutoStep; states: string[]; checks: string[]; points: NamedPoint[]; disabled: boolean; onChange: (step: AutoStep) => void };

export function AutoInspector({ step, states, checks, points, disabled, onChange }: AutoInspectorProps) {
  return <Stack spacing={2} aria-label="Step settings" key={step.id}>
    <Typography variant="subtitle1">Step settings</Typography>
    {step.type === "drive" && <>
      <Stack direction="row" spacing={1}>
        <AutoNumberField label="X (m)" value={step.x} disabled={disabled} onChange={x => onChange({ ...step, x })} />
        <AutoNumberField label="Y (m)" value={step.y} disabled={disabled} onChange={y => onChange({ ...step, y })} />
      </Stack>
      <AutoNumberField label="Heading (deg)" value={step.heading} disabled={disabled} onChange={heading => onChange({ ...step, heading })} />
      <AdvancedDriveSettings step={step} states={states} points={points} disabled={disabled} onChange={onChange} />
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
    {step.type === "branch" && <BranchConditionSettings step={step} states={states} checks={checks} disabled={disabled} onChange={onChange} />}
  </Stack>;
}
