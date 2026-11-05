import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import type { Alliance } from "../autoModel";

type AllianceToggleProps = {
  value: Alliance | null;
  onChange: (alliance: Alliance | null) => void;
};

/** Which alliance's chooser shows the auto. */
export function AllianceToggle({ value, onChange }: AllianceToggleProps) {
  return <Tooltip title="Which alliance's chooser shows this auto. Coordinates are never flipped automatically.">
    <ToggleButtonGroup size="small" exclusive value={value ?? "Any"} aria-label="Alliance"
      onChange={(_, next: Alliance | "Any" | null) => { if (next) onChange(next === "Any" ? null : next); }}>
      <ToggleButton value="Any">Any</ToggleButton>
      <ToggleButton value="Blue" sx={{ "&.Mui-selected": { color: "#60a5fa" } }}>Blue</ToggleButton>
      <ToggleButton value="Red" sx={{ "&.Mui-selected": { color: "#f87171" } }}>Red</ToggleButton>
    </ToggleButtonGroup>
  </Tooltip>;
}
