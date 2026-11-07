import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { GraphView } from "../logModel";

type GraphViewSelectorProps = {
  options: { view: GraphView; label: string }[];
  value: GraphView;
  name: string;
  onChange: (view: GraphView) => void;
};

/** What one graph shows, as a row of segments across the top of the graph. */
export function GraphViewSelector({ options, value, name, onChange }: GraphViewSelectorProps) {
  if (options.length < 2) return null;
  return (
    <ToggleButtonGroup exclusive fullWidth size="small" color="primary" value={value} aria-label={`What the ${name} graph shows`}
      onChange={(_, view: GraphView | null) => { if (view) onChange(view); }}>
      {options.map(option => (
        <ToggleButton key={option.view} value={option.view} sx={{ py: 0, minHeight: 22, textTransform: "none", fontSize: 11, fontWeight: 700,
          borderColor: "rgba(250,250,250,0.08)", color: "text.secondary" }}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
