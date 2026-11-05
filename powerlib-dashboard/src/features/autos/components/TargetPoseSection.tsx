import { Box, TextField, Tooltip, Typography } from "@mui/material";
import type { DriveStep, NamedPoint } from "../autoModel";
import { legEndHeading, round } from "../autoModel";
import { FieldRow } from "./FieldRow";
import { NamedPointLink } from "./NamedPointLink";
import { NumberField } from "./NumberField";
import { SettingsSection } from "./SettingsSection";

type TargetPoseSectionProps = {
  step: DriveStep;
  /** The field is showing the mirrored copy; the values are still the original auto's. */
  mirrored: boolean;
  points: NamedPoint[];
  onChange: (patch: Partial<DriveStep>) => void;
  onLinkPoint: (pointId: string | null) => void;
  onSavePoint: () => void;
  onRenamePoint: (name: string) => void;
};

/** Where a drive leg ends: its named point, X, Y and heading. */
export function TargetPoseSection({ step, mirrored, points, onChange, onLinkPoint, onSavePoint, onRenamePoint }: TargetPoseSectionProps) {
  const facing = step.turn.mode === "face";
  return <SettingsSection title="Target pose" hint={`${mirrored ? "Values are for the original auto; the field is showing the mirrored copy."
    : "Blue-origin field coordinates."} A named point is saved once and reused across autos; moving it moves every step linked to it.`}>
    <NamedPointLink linked={step.pointId ? points.find(point => point.id === step.pointId) : undefined} points={points}
      onLink={onLinkPoint} onSave={onSavePoint} onRename={onRenamePoint} />
    <FieldRow>
      <NumberField label="X" unit="m" value={step.x} onChange={value => onChange({ x: value ?? 0 })} />
      <NumberField label="Y" unit="m" value={step.y} onChange={value => onChange({ y: value ?? 0 })} />
      {facing
        ? <Tooltip title="Facing a point sets the heading"><Box sx={{ width: "100%" }}>
          <TextField size="small" label="Heading" value={round(legEndHeading(step), 1)} disabled fullWidth
            slotProps={{ input: { endAdornment: <Typography variant="caption" color="text.secondary">°</Typography> } }} />
        </Box></Tooltip>
        : <NumberField label="Heading" unit="°" value={step.heading} onChange={value => onChange({ heading: value ?? 0 })} />}
    </FieldRow>
  </SettingsSection>;
}
