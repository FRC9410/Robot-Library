import { MenuItem, TextField } from "@mui/material";
import type { BranchStep } from "../autoModel";
import { AutoNumberField } from "./AutoNumberField";

export function BranchConditionSettings({ step, states, checks, disabled, onChange }: {
  step: BranchStep; states: string[]; checks: string[]; disabled: boolean; onChange: (step: BranchStep) => void;
}) {
  const condition = step.condition;
  return <>
    <TextField select label="Branch condition" value={condition.kind} size="small" disabled={disabled} onChange={event => onChange({ ...step,
      condition: event.target.value === "state" ? { kind: "state", state: states[0] ?? "", waitSeconds: 0 }
        : event.target.value === "check" ? { kind: "check", method: checks[0] ?? "", waitSeconds: 0 } : { kind: "timeLeft", seconds: 5 } })}>
      <MenuItem value="state" disabled={!states.length}>Robot state</MenuItem>
      <MenuItem value="check" disabled={!checks.length}>Robot check</MenuItem>
      <MenuItem value="timeLeft">Time remaining</MenuItem>
    </TextField>
    {condition.kind === "state" && <TextField select label="Branch robot state" value={condition.state} size="small" disabled={disabled}
      onChange={event => onChange({ ...step, condition: { ...condition, state: event.target.value } })}>
      {!states.includes(condition.state) && <MenuItem value={condition.state}>{condition.state || "Choose a state"}</MenuItem>}
      {states.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
    </TextField>}
    {condition.kind === "check" && <TextField select label="Robot check" value={condition.method} size="small" disabled={disabled}
      onChange={event => onChange({ ...step, condition: { ...condition, method: event.target.value } })}>
      {!checks.includes(condition.method) && <MenuItem value={condition.method}>{condition.method || "Choose a check"}</MenuItem>}
      {checks.map(method => <MenuItem key={method} value={method}>{method}()</MenuItem>)}
    </TextField>}
    {condition.kind === "timeLeft" ? <AutoNumberField label="At least time remaining (s)" value={condition.seconds} min={.001} disabled={disabled}
      onChange={seconds => onChange({ ...step, condition: { ...condition, seconds } })} />
      : <AutoNumberField label="Wait for condition (s)" value={condition.waitSeconds} min={0} disabled={disabled}
        onChange={waitSeconds => onChange({ ...step, condition: { ...condition, waitSeconds } })} />}
  </>;
}
