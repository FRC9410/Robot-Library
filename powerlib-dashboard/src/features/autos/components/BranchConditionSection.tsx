import { Alert, MenuItem, TextField } from "@mui/material";
import type { BranchCondition, BranchStep } from "../autoModel";
import { conditionWithKind } from "../autoEdits";
import { NumberField } from "./NumberField";
import { SettingsSection } from "./SettingsSection";
import { StateSelect } from "./StateSelect";

type BranchConditionSectionProps = {
  step: BranchStep;
  states: string[];
  /** StateMachine's yes/no methods a branch can check. */
  checks: string[];
  onChange: (condition: BranchCondition) => void;
};

/** What a branch checks: a state, a robot check such as a sensor, or the time left; and how long it waits for a yes. */
export function BranchConditionSection({ step, states, checks, onChange }: BranchConditionSectionProps) {
  const condition = step.condition;
  const methods = condition.kind === "check" && condition.method && !checks.includes(condition.method) ? [...checks, condition.method] : checks;
  return <SettingsSection title="If" hint={"Checked when the robot reaches this step. It runs Then or Otherwise, then carries on with the steps after the branch. "
    + "Wait up to: how long to wait for a yes first; 0 checks once."}>
    <TextField select size="small" label="Check" value={condition.kind} fullWidth
      onChange={event => {
        const kind = event.target.value as BranchCondition["kind"];
        if (kind !== condition.kind) onChange(conditionWithKind(step, kind, states, checks));
      }}>
      <MenuItem value="state">The robot is in a state</MenuItem>
      <MenuItem value="check">A robot check, such as a sensor</MenuItem>
      <MenuItem value="timeLeft">Enough time is left</MenuItem>
    </TextField>
    {condition.kind === "state" && <StateSelect value={condition.state} states={states} onChange={state => onChange({ ...condition, state })} />}
    {condition.kind === "check" && (methods.length
      ? <TextField select size="small" label="Robot check" value={condition.method} error={!checks.includes(condition.method)} fullWidth
        onChange={event => onChange({ ...condition, method: event.target.value })}>
        {methods.map(method => <MenuItem key={method} value={method}>{method}()</MenuItem>)}
      </TextField>
      : <Alert severity="info" sx={{ py: 0 }}>Add a method such as <code>public boolean hasFuel()</code> to StateMachine and it shows up here.</Alert>)}
    {condition.kind === "timeLeft"
      ? <NumberField label="At least" unit="s left" value={condition.seconds} onChange={value => onChange({ ...condition, seconds: value ?? 0 })} />
      : <NumberField label="Wait up to" unit="s" value={condition.waitSeconds} onChange={value => onChange({ ...condition, waitSeconds: value ?? 0 })} />}
  </SettingsSection>;
}
