import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import type { Symmetry } from "../autoModel";

type SymmetryToggleProps = {
  value: Symmetry;
  onChange: (symmetry: Symmetry) => void;
};

/** Whether the auto also gets a mirrored copy for the other side, and how it's flipped. */
export function SymmetryToggle({ value, onChange }: SymmetryToggleProps) {
  return <Tooltip title="Symmetry: also generate a mirrored copy for the other side. Flip across the center line (↔), top to bottom (↕), or both.">
    <ToggleButtonGroup size="small" value={[...(value.flipX ? ["x"] : []), ...(value.flipY ? ["y"] : [])]} aria-label="Mirrored copy"
      onChange={(_, values: string[]) => onChange({ flipX: values.includes("x"), flipY: values.includes("y") })}>
      <ToggleButton value="x" aria-label="Mirror across the center line"><SwapHorizIcon fontSize="small" /></ToggleButton>
      <ToggleButton value="y" aria-label="Mirror top to bottom"><SwapVertIcon fontSize="small" /></ToggleButton>
    </ToggleButtonGroup>
  </Tooltip>;
}
