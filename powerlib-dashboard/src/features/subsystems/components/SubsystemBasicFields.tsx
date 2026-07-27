import { Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
import type { SubsystemFormState } from "../types";
import { toCamelCase } from "../subsystemUtils";

type SubsystemBasicFieldsProps = {
  form: SubsystemFormState;
  setForm: (updater: (current: SubsystemFormState | null) => SubsystemFormState | null) => void;
  updateField: <K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) => void;
};

export function SubsystemBasicFields({ form, setForm, updateField }: SubsystemBasicFieldsProps) {
  return (
    <>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          label="Subsystem name"
          size="small"
          value={form.name}
          onChange={(event) =>
            setForm((current) =>
              current
                ? {
                    ...current,
                    name: event.target.value,
                    id: current.mode === "create" ? toCamelCase(event.target.value) : current.id
                  }
                : current
            )
          }
          sx={{ flexGrow: 1 }}
        />
        <TextField
          label="Stable ID"
          size="small"
          value={form.id}
          onChange={(event) => setForm((current) => (current ? { ...current, id: event.target.value } : current))}
          sx={{ minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="subsystem-type-label">Type</InputLabel>
          <Select
            labelId="subsystem-type-label"
            label="Type"
            value={form.type}
            onChange={(event) => updateField("type", event.target.value as SubsystemFormState["type"])}
          >
            <MenuItem value="velocity">velocity</MenuItem>
            <MenuItem value="velocityTorque">velocity torque</MenuItem>
            <MenuItem value="absolutePosition">absolute position</MenuItem>
            <MenuItem value="relativePosition">relative position</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          label="Sensor-to-mechanism ratio"
          size="small"
          type="number"
          value={form.sensorToMechanism}
          onChange={(event) => updateField("sensorToMechanism", event.target.value)}
        />
        <TextField
          label="Rotor-to-mechanism ratio"
          size="small"
          type="number"
          value={form.rotorToSensor}
          onChange={(event) => updateField("rotorToSensor", event.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="subsystem-neutral-mode-label">Neutral mode</InputLabel>
          <Select
            labelId="subsystem-neutral-mode-label"
            label="Neutral mode"
            value={form.neutralMode}
            onChange={(event) => updateField("neutralMode", event.target.value as "Brake" | "Coast")}
          >
            <MenuItem value="Brake">Brake</MenuItem>
            <MenuItem value="Coast">Coast</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Checkbox checked={form.focEnabled} onChange={(event) => updateField("focEnabled", event.target.checked)} />}
          label="FOC enabled"
        />
      </Stack>
    </>
  );
}
