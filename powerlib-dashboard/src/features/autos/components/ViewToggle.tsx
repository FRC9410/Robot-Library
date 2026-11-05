import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { AutoView } from "../types";

type ViewToggleProps = {
  value: AutoView;
  onChange: (view: AutoView) => void;
};

/** Switches between the field and the generated Java. */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return <ToggleButtonGroup size="small" exclusive value={value} aria-label="View" onChange={(_, next: AutoView | null) => next && onChange(next)}>
    <ToggleButton value="field">Field</ToggleButton>
    <ToggleButton value="code">Code</ToggleButton>
  </ToggleButtonGroup>;
}
