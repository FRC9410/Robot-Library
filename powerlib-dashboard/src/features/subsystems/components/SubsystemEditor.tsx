import { Box, Button, Card, CardContent, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";
import DeleteIcon from "@mui/icons-material/Delete";
import InsightsIcon from "@mui/icons-material/Insights";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import SaveIcon from "@mui/icons-material/Save";
import type { SubsystemFormMotor, SubsystemFormState } from "../types";
import { CancoderFields } from "./CancoderFields";
import { AbsolutePositionFields } from "./AbsolutePositionFields";
import { ControlConstantsGrid } from "./ControlConstantsGrid";
import { MotorListEditor } from "./MotorListEditor";
import { SubsystemBasicFields } from "./SubsystemBasicFields";

type SubsystemEditorProps = {
  form: SubsystemFormState | null;
  saving: boolean;
  setForm: (updater: (current: SubsystemFormState | null) => SubsystemFormState | null) => void;
  updateField: <K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) => void;
  updateMotor: (index: number, patch: Partial<SubsystemFormMotor>) => void;
  addMotor: () => void;
  deleteMotor: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onOpenCharacterization: () => void;
  onOpenSimulation: () => void;
};

export function SubsystemEditor({
  form,
  saving,
  setForm,
  updateField,
  updateMotor,
  addMotor,
  deleteMotor,
  onSave,
  onCancel,
  onDelete,
  onOpenCharacterization,
  onOpenSimulation
}: SubsystemEditorProps) {
  return (
    <Stack sx={{ minHeight: 0 }}>
      <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden", flexGrow: 1 }}>
        <CardContent sx={{ height: "100%", overflowY: "auto" }}>
          {form ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">
                    {form.mode === "create" ? "Create Subsystem" : `Edit ${form.name || "Subsystem"}`}
                  </Typography>
                </Box>
                {(form.type === "velocity" || form.type === "velocityTorque") && (
                  <Button startIcon={<InsightsIcon />} variant="outlined" onClick={onOpenCharacterization}>
                    Characterization
                  </Button>
                )}
              </Stack>

              <Divider />

              <SubsystemBasicFields form={form} setForm={setForm} updateField={updateField} />
              <Divider />
              <MotorListEditor motors={form.motors} onAddMotor={addMotor} onDeleteMotor={deleteMotor} onUpdateMotor={updateMotor} />
              <Divider />
              <CancoderFields form={form} updateField={updateField} />
              <AbsolutePositionFields form={form} updateField={updateField} />
              <ControlConstantsGrid form={form} updateField={updateField} />
              <Stack direction="row" sx={{ justifyContent: "flex-start" }}>
                <Button startIcon={<PrecisionManufacturingIcon />} variant="outlined" onClick={onOpenSimulation}>
                  Simulation Settings
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ alignItems: "center", justifyContent: "center", minHeight: 420, textAlign: "center" }}>
              <ConstructionIcon color="primary" sx={{ fontSize: 48 }} />
              <Box>
                <Typography variant="h6">Select a subsystem config</Typography>
                <Typography color="text.secondary">Choose a config from the sidebar or create a new subsystem.</Typography>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>

      {form && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            borderTop: 1,
            borderColor: "divider",
            px: 0,
            py: 1.5
          }}
        >
          <Button startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />} variant="contained" onClick={onSave} disabled={saving}>
            Save Subsystem
          </Button>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {form.mode === "edit" && form.index !== null && (
            <Button color="error" startIcon={<DeleteIcon />} onClick={onDelete} disabled={saving}>
              Delete
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
