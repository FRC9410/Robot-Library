import { Box } from "@mui/material";
import type { GeneratedSubsystem, SubsystemDocumentState, SubsystemFormMotor, SubsystemFormState } from "../types";
import { SubsystemEditor } from "./SubsystemEditor";
import { SubsystemSidebar } from "./SubsystemSidebar";

type SubsystemsPanelProps = {
  document: SubsystemDocumentState;
  form: SubsystemFormState | null;
  saving: boolean;
  setForm: (updater: (current: SubsystemFormState | null) => SubsystemFormState | null) => void;
  updateField: <K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) => void;
  updateMotor: (index: number, patch: Partial<SubsystemFormMotor>) => void;
  addMotor: () => void;
  deleteMotor: (index: number) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onSelect: (subsystem: GeneratedSubsystem, index: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onOpenCharacterization: () => void;
  onOpenSimulation: () => void;
  onOpenDrivetrainSimulation: () => void;
};

export function SubsystemsPanel({
  document,
  form,
  saving,
  setForm,
  updateField,
  updateMotor,
  addMotor,
  deleteMotor,
  onCreate,
  onRefresh,
  onSelect,
  onSave,
  onCancel,
  onDelete,
  onOpenCharacterization,
  onOpenSimulation,
  onOpenDrivetrainSimulation
}: SubsystemsPanelProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
        height: { xs: "auto", md: "calc(100vh - 150px)" },
        minHeight: { md: 520 },
        overflow: { xs: "visible", md: "hidden" }
      }}
    >
      <SubsystemSidebar
        document={document}
        form={form}
        onCreate={onCreate}
        onRefresh={onRefresh}
        onSelect={onSelect}
        onOpenDrivetrainSimulation={onOpenDrivetrainSimulation}
      />
      <SubsystemEditor
        form={form}
        saving={saving}
        setForm={setForm}
        updateField={updateField}
        updateMotor={updateMotor}
        addMotor={addMotor}
        deleteMotor={deleteMotor}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={onDelete}
        onOpenCharacterization={onOpenCharacterization}
        onOpenSimulation={onOpenSimulation}
      />
    </Box>
  );
}
