import { ToggleButton, ToggleButtonGroup } from "@mui/material";

type MirrorViewToggleProps = {
  /** Labels for the original auto and its mirrored copy, such as "Blue" and "Red copy". */
  originalLabel: string;
  mirrorLabel: string;
  showingMirror: boolean;
  onChange: (showMirror: boolean) => void;
};

/** Shows the auto as written or its mirrored copy on the field. */
export function MirrorViewToggle({ originalLabel, mirrorLabel, showingMirror, onChange }: MirrorViewToggleProps) {
  return <ToggleButtonGroup size="small" exclusive value={showingMirror ? "mirror" : "original"} aria-label="Copy shown on the field"
    onChange={(_, value: string | null) => { if (value) onChange(value === "mirror"); }}>
    <ToggleButton value="original">{originalLabel}</ToggleButton>
    <ToggleButton value="mirror">{mirrorLabel}</ToggleButton>
  </ToggleButtonGroup>;
}
