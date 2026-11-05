import { ToggleButton, Tooltip } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";

type TagViewToggleProps = {
  selected: boolean;
  /** A field layout with AprilTags is picked. */
  available: boolean;
  onToggle: () => void;
};

/** Turns the tag view on: camera coverage on the field and AprilTag coverage under the timeline. */
export function TagViewToggle({ selected, available, onToggle }: TagViewToggleProps) {
  return <Tooltip title={available
    ? "Show what each camera can see, and which AprilTags the robot could place itself with along the route"
    : "Pick a field layout in the View menu to see AprilTags"}>
    <span>
      <ToggleButton size="small" value="tags" selected={selected} disabled={!available} sx={{ px: 1, whiteSpace: "nowrap" }} onChange={onToggle}>
        <VisibilityIcon fontSize="small" sx={{ mr: 0.5 }} />Tags
      </ToggleButton>
    </span>
  </Tooltip>;
}
