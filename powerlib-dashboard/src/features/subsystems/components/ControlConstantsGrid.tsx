import { Box, Card, CardContent, Divider, Stack, TextField, Typography } from "@mui/material";
import type { SubsystemFormState } from "../types";

type ControlConstantsGridProps = {
  form: SubsystemFormState;
  updateField: <K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) => void;
};

export function ControlConstantsGrid({ form, updateField }: ControlConstantsGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(180px, 320px))" },
        justifyContent: "start"
      }}
    >
      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              PID
            </Typography>
            <Divider />
            <TextField fullWidth label="kP" size="small" type="number" value={form.kP} onChange={(event) => updateField("kP", event.target.value)} />
            <TextField fullWidth label="kI" size="small" type="number" value={form.kI} onChange={(event) => updateField("kI", event.target.value)} />
            <TextField fullWidth label="kD" size="small" type="number" value={form.kD} onChange={(event) => updateField("kD", event.target.value)} />
            <TextField fullWidth label="kG" size="small" type="number" value={form.kG} onChange={(event) => updateField("kG", event.target.value)} />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Feedforward
            </Typography>
            <Divider />
            <TextField fullWidth label="kS" size="small" type="number" value={form.kS} onChange={(event) => updateField("kS", event.target.value)} />
            <TextField fullWidth label="kV" size="small" type="number" value={form.kV} onChange={(event) => updateField("kV", event.target.value)} />
            <TextField fullWidth label="kA" size="small" type="number" value={form.kA} onChange={(event) => updateField("kA", event.target.value)} />
            {form.type === "velocityTorque" && (
              <TextField fullWidth label="Torque FF" size="small" type="number" value={form.torqueFF} onChange={(event) => updateField("torqueFF", event.target.value)} />
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Motion Magic
            </Typography>
            <Divider />
            <TextField fullWidth label="Acceleration" size="small" type="number" value={form.acceleration} onChange={(event) => updateField("acceleration", event.target.value)} />
            <TextField fullWidth label="Cruise velocity" size="small" type="number" value={form.cruiseVelocity} onChange={(event) => updateField("cruiseVelocity", event.target.value)} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
