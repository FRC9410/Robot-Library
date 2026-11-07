import { Card, CardContent, Divider, Stack, TextField, Typography } from "@mui/material";
import type { SubsystemFormState } from "../types";

type CancoderFieldsProps = {
  form: SubsystemFormState;
  updateField: <K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) => void;
};

export function CancoderFields({ form, updateField }: CancoderFieldsProps) {
  if (form.type !== "absolutePosition") {
    return null;
  }

  return (
    <Stack spacing={1} sx={{ width: "100%", maxWidth: 320 }}>
      <Typography component="h4" variant="subtitle1" sx={{ fontWeight: 700 }}>Sensor</Typography>
      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">CANcoder</Typography>
            <Divider />
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
        </CardContent>
      </Card>
    </Stack>
  );
}
