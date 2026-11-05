import { MenuItem, TextField } from "@mui/material";

type StateSelectProps = {
  value: string;
  /** The robot's states, from StateMachine; a value not in the list still shows, marked as an error. */
  states: string[];
  label?: string;
  onChange: (state: string) => void;
};

export function StateSelect({ value, states, label = "State", onChange }: StateSelectProps) {
  const options = value && !states.includes(value) ? [...states, value] : states;
  return <TextField select size="small" label={label} value={value} error={!states.includes(value)} fullWidth onChange={event => onChange(event.target.value)}>
    {options.length === 0 && <MenuItem value="" disabled>No states found in StateMachine</MenuItem>}
    {options.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
  </TextField>;
}
