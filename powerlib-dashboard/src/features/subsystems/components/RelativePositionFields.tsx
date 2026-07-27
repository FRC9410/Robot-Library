import { Card, CardContent, Box, Divider, Stack, TextField, Typography } from "@mui/material";
import type { SubsystemFormState } from "../types";

type RelativePositionFieldsProps = {
  form: SubsystemFormState;
  updateField: <K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) => void;
};

export function RelativePositionFields({ form, updateField }: RelativePositionFieldsProps) {
  if (form.type !== "relativePosition") {
    return null;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(180px, 320px))" },
        justifyContent: "start"
      }}
    >
      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Relative Position
            </Typography>
            <Divider />
            <TextField fullWidth label="Position units" size="small" value={form.positionUnits} onChange={(event) => updateField("positionUnits", event.target.value)} />
            <TextField fullWidth label="Home position" size="small" type="number" value={form.homePosition} onChange={(event) => updateField("homePosition", event.target.value)} />
            <TextField fullWidth label="Forward soft limit" size="small" type="number" value={form.forwardSoftLimit} onChange={(event) => updateField("forwardSoftLimit", event.target.value)} />
            <TextField fullWidth label="Reverse soft limit" size="small" type="number" value={form.reverseSoftLimit} onChange={(event) => updateField("reverseSoftLimit", event.target.value)} />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Behavior
            </Typography>
            <Divider />
            <TextField fullWidth label="Slow threshold" size="small" type="number" value={form.slowThreshold} onChange={(event) => updateField("slowThreshold", event.target.value)} />
            <TextField fullWidth label="Tolerance" size="small" type="number" value={form.tolerance} onChange={(event) => updateField("tolerance", event.target.value)} />
            <TextField fullWidth label="Stop voltage" size="small" type="number" value={form.stopVoltage} onChange={(event) => updateField("stopVoltage", event.target.value)} />
            <TextField fullWidth label="Slow cruise velocity" size="small" type="number" value={form.slowCruiseVelocity} onChange={(event) => updateField("slowCruiseVelocity", event.target.value)} />
            <TextField fullWidth label="Slow acceleration" size="small" type="number" value={form.slowAcceleration} onChange={(event) => updateField("slowAcceleration", event.target.value)} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
