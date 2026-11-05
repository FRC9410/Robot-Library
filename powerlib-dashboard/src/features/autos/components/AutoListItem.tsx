import { Chip } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import type { AutoRoutine } from "../autoModel";
import { allSteps } from "../autoModel";

type AutoListItemProps = {
  auto: AutoRoutine;
  selected: boolean;
  /** Problems that stop the autos being written to robot code. */
  errorCount: number;
  /** How long the replay takes, in seconds. */
  seconds: number;
  onSelect: () => void;
  /** Right-click, at the pointer. */
  onMenu: (x: number, y: number) => void;
};

/** One auto in the list: alliance, name, steps, time, and whether it's the default or has problems. */
export function AutoListItem({ auto, selected, errorCount, seconds, onSelect, onMenu }: AutoListItemProps) {
  const mirrored = auto.symmetry.flipX || auto.symmetry.flipY;
  return <li className={`ab-auto${selected ? " selected" : ""}`} onClick={onSelect} title="Right-click to duplicate, flip or delete"
    onContextMenu={event => { event.preventDefault(); onMenu(event.clientX, event.clientY); }}>
    <span className={`ab-alliance-dot ${auto.alliance ?? ""}`} title={auto.alliance ?? "Any alliance"} />
    <span className="ab-auto-text">
      <span className="ab-auto-name">{auto.name || "(unnamed)"}</span>
      <span className="ab-auto-meta">{allSteps(auto.steps).length} steps{seconds > 0 ? ` · ${seconds.toFixed(1)} s` : ""}{mirrored ? " · mirrored" : ""}</span>
    </span>
    <span className="ab-auto-badges">
      {auto.isDefault && <StarIcon fontSize="small" color="primary" titleAccess="Default auto" />}
      {errorCount > 0 && <Chip size="small" label={errorCount} color="error" />}
    </span>
  </li>;
}
