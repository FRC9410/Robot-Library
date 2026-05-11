import { Divider, Stack, TextField, Typography } from "@mui/material";
import type { SubsystemFormState } from "../types";

type CancoderFieldsProps = {
  form: SubsystemFormState;
  updateField: <K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) => void;
};

export function CancoderFields({ form, updateField }: CancoderFieldsProps) {
  if (form.type !== "position") {
    return null;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        CANcoder
      </Typography>
      <Divider />
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          label="CANcoder CAN ID"
          size="small"
          type="number"
          value={form.cancoderId}
          onChange={(event) => updateField("cancoderId", event.target.value)}
        />
        <TextField
          label="CANcoder magnet offset"
          size="small"
          type="number"
          value={form.cancoderMagnetOffset}
          onChange={(event) => updateField("cancoderMagnetOffset", event.target.value)}
        />
        <TextField
          label="CANcoder discontinuity point"
          size="small"
          type="number"
          value={form.cancoderDiscontinuityPoint}
          onChange={(event) => updateField("cancoderDiscontinuityPoint", event.target.value)}
        />
        <TextField
          label="Position units"
          size="small"
          value={form.positionUnits}
          onChange={(event) => updateField("positionUnits", event.target.value)}
        />
        <TextField
          label="Default position"
          size="small"
          type="number"
          value={form.defaultPosition}
          onChange={(event) => updateField("defaultPosition", event.target.value)}
        />
      </Stack>
    </Stack>
  );
}
