import { Button, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import type { AutoStep, DriveStep, LegConstraints } from "../autoModel";
import { FieldRow } from "./FieldRow";
import { LegLimitFields } from "./LegLimitFields";
import { SettingsSection } from "./SettingsSection";
import { TooltipIconButton } from "./TooltipIconButton";

type MultiStepInspectorProps = {
  steps: AutoStep[];
  onApplyLimits: (limits: Partial<LegConstraints>) => void;
  /** Lines the selected points up with the last selected point. */
  onAlign: (axis: "x" | "y") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Clears the selection. */
  onClose: () => void;
};

/** Settings shared by several selected steps; a blank field means the steps differ. */
export function MultiStepInspector({ steps, onApplyLimits, onAlign, onDuplicate, onDelete, onClose }: MultiStepInspectorProps) {
  const drives = steps.filter((step): step is DriveStep => step.type === "drive");
  const shared = (key: keyof LegConstraints) => drives.every(drive => drive[key] === drives[0][key]) ? drives[0][key] : null;
  const apply = (key: keyof LegConstraints, value: number) => onApplyLimits({ [key]: value });
  return <Stack spacing={2}>
    <Stack direction="row" sx={{ alignItems: "center" }}>
      <Typography sx={{ fontWeight: 600, flex: 1 }}>{steps.length} steps selected</Typography>
      <TooltipIconButton title="Clear the selection (Esc)" label="Clear the selection" onClick={onClose}><CloseIcon fontSize="small" /></TooltipIconButton>
    </Stack>
    {drives.length > 0 && <>
      <SettingsSection title={`Motion limits (${drives.length} drive step${drives.length === 1 ? "" : "s"})`}>
        <LegLimitFields keys={["maxVelocity", "maxAcceleration"]} value={shared} mixed onChange={apply} />
      </SettingsSection>
      <SettingsSection title="Finish when">
        <LegLimitFields keys={["endDistanceTolerance", "endVelocityTolerance"]} value={shared} mixed onChange={apply} />
      </SettingsSection>
      {drives.length > 1 && <SettingsSection title="Align" hint="Lines the selected points up with the last one you selected.">
        <FieldRow>
          <Button size="small" variant="outlined" onClick={() => onAlign("x")}>Same X</Button>
          <Button size="small" variant="outlined" onClick={() => onAlign("y")}>Same Y</Button>
        </FieldRow>
      </SettingsSection>}
    </>}
    <FieldRow>
      <Button size="small" variant="outlined" onClick={onDuplicate}>Duplicate</Button>
      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>Delete</Button>
    </FieldRow>
  </Stack>;
}
