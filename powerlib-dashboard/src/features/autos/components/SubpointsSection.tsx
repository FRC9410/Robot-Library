import { Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { DriveStep, Subpoint } from "../autoModel";
import { createId } from "../autoModel";
import { SettingsSection } from "./SettingsSection";
import { SubpointRow } from "./SubpointRow";

type SubpointsSectionProps = {
  step: DriveStep;
  /** The first leg starts wherever the robot is placed, so its subpoints all fire at once in the replay. */
  isFirstLeg: boolean;
  states: string[];
  onChange: (subpoints: Subpoint[]) => void;
};

/** States requested partway along a leg. */
export function SubpointsSection({ step, isFirstLeg, states, onChange }: SubpointsSectionProps) {
  const hint = step.subpoints.length === 0 ? undefined : isFirstLeg
    ? "Requests a state partway along the leg, or when the leg ends if it finishes first. The first leg starts wherever the robot is placed; the replay starts at point 1, so these run at once there."
    : "Requests a state partway along the leg, or when the leg ends if it finishes first. Drag the diamonds on the field to move them.";
  return <SettingsSection title="During this move" hint={hint}>
    {step.subpoints.map(subpoint => <SubpointRow key={subpoint.id} subpoint={subpoint} states={states}
      onChange={patch => onChange(step.subpoints.map(candidate => candidate.id === subpoint.id ? { ...candidate, ...patch } : candidate))}
      onRemove={() => onChange(step.subpoints.filter(candidate => candidate.id !== subpoint.id))} />)}
    <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} disabled={states.length === 0}
      onClick={() => onChange([...step.subpoints, { id: createId(), progress: 0.5, state: states[0] ?? "" }])}>
      Add state change
    </Button>
  </SettingsSection>;
}
