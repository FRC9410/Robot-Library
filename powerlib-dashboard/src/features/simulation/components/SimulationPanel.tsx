import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { SimConfig } from "../types";

type SimulationPanelProps = {
  config: SimConfig;
  saving: boolean;
  onSave: (config: SimConfig) => void;
};

type FieldDef = {
  key: keyof SimConfig;
  label: string;
  unit: string;
  tooltip: string;
  min: number;
};

const FIELDS: FieldDef[] = [
  {
    key: "robotMassKg",
    label: "Robot Mass",
    unit: "kg",
    tooltip: "Total robot weight including battery and bumpers.",
    min: 1
  },
  {
    key: "robotMoiKgM2",
    label: "Moment of Inertia",
    unit: "kg·m²",
    tooltip: "Rotational inertia of the robot. Rough estimate: mass × 0.1",
    min: 0.1
  },
  {
    key: "bumperWidthMeters",
    label: "Bumper Width",
    unit: "m",
    tooltip: "Full robot width including bumpers (side-to-side).",
    min: 0.1
  },
  {
    key: "bumperLengthMeters",
    label: "Bumper Length",
    unit: "m",
    tooltip: "Full robot length including bumpers (front-to-back).",
    min: 0.1
  }
];

export function SimulationPanel({ config, saving, onSave }: SimulationPanelProps) {
  const [draft, setDraft] = useState<SimConfig>(config);

  function handleChange(key: keyof SimConfig, raw: string) {
    const value = parseFloat(raw);
    if (!Number.isNaN(value)) {
      setDraft((current) => ({ ...current, [key]: value }));
    }
  }

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Simulation Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Physical robot parameters used by MapleeSim for realistic swerve drive simulation.
              </Typography>
            </Stack>

            {FIELDS.map(({ key, label, unit, tooltip, min }) => (
              <TextField
                key={key}
                label={label}
                type="number"
                value={draft[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                          <Typography variant="caption" color="text.secondary">
                            {unit}
                          </Typography>
                          <Tooltip title={tooltip} placement="top">
                            <InfoOutlinedIcon fontSize="small" color="action" sx={{ cursor: "help" }} />
                          </Tooltip>
                        </Stack>
                      </InputAdornment>
                    )
                  },
                  htmlInput: { min, step: "any" }
                }}
                size="small"
                fullWidth
              />
            ))}

            <Button
              variant="contained"
              disabled={saving}
              onClick={() => onSave(draft)}
              sx={{ alignSelf: "flex-start" }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
