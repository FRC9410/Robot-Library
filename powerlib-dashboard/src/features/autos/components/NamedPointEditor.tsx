import type { ReactNode } from "react";
import { Box, Paper, Stack, TextField, Typography } from "@mui/material";
import type { NamedPoint } from "../autoModel";
import { AutoNumberField } from "./AutoNumberField";

export function NamedPointEditor({ point, points, disabled, onChange, footer }: { point: NamedPoint | undefined; points: NamedPoint[];
  disabled: boolean; onChange: (point: NamedPoint) => void; footer: ReactNode }) {
  const duplicate = point && points.some(other => other.id !== point.id && other.name.trim() === point.name.trim());
  return <Paper variant="outlined" aria-label="Named point editor" sx={{ p: 1.5, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <Typography variant="subtitle1">Named point</Typography>
      {point ? <Stack spacing={2} key={point.id}>
        <TextField label="Point name" size="small" value={point.name} disabled={disabled} error={!point.name.trim() || duplicate}
          helperText={duplicate ? "This point name is already used." : undefined} slotProps={{ htmlInput: { maxLength: 100 } }}
          onChange={event => onChange({ ...point, name: event.target.value })} />
        <Stack direction="row" spacing={1}>
          <AutoNumberField label="X (m)" value={point.x} disabled={disabled} onChange={x => onChange({ ...point, x })} />
          <AutoNumberField label="Y (m)" value={point.y} disabled={disabled} onChange={y => onChange({ ...point, y })} />
        </Stack>
        <AutoNumberField label="Heading (deg)" value={point.heading} disabled={disabled} onChange={heading => onChange({ ...point, heading })} />
      </Stack> : <Typography color="text.secondary" variant="body2">Select a point or create one.</Typography>}
    </Stack>
    <Box sx={{ pt: 1.5, flexShrink: 0 }}>{footer}</Box>
  </Paper>;
}
