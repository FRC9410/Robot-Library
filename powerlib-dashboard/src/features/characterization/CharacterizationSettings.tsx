import { Stack, TextField, Typography } from "@mui/material";
import { limitsFields, resolveLimits } from "../../../electron/characterization/limits";
import type { Settings } from "../../../electron/characterization/types";

type CharacterizationSettingsProps = { value: Settings; onChange: (value: Settings) => void };
const sharedFields = [
  ["settle", "Disabled gap (s)", .2, 10],
  ["medianWindow", "Median window", 1, 9]
] as const;

export function CharacterizationSettings({ value, onChange }: CharacterizationSettingsProps) {
  const limits = resolveLimits(value);
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1">Test settings</Typography>
      {limitsFields.map(([key, label, min, max]) => (
        <TextField key={key} label={label} type="number" size="small" value={limits[key]}
          slotProps={{ htmlInput: { min, max, step: .1 } }}
          onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} />
      ))}
      {sharedFields.map(([key, label, min, max]) => (
        <TextField key={key} label={label} type="number" size="small" value={value[key]}
          slotProps={{ htmlInput: { min, max, step: key === "medianWindow" ? 2 : .1 } }}
          onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} />
      ))}
    </Stack>
  );
}
