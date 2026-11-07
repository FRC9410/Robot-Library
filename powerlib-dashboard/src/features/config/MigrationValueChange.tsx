import { Box, Checkbox, Stack, Typography } from "@mui/material";
import type { MigrationChange } from "../../../electron/java-config/legacyMigration";

type MigrationValueChangeProps = { change: MigrationChange; selected: boolean; disabled: boolean; onToggle: () => void };
const display = (value: unknown) => value === undefined ? "Not present" : typeof value === "object" ? JSON.stringify(value) : String(value);

export function MigrationValueChange({ change, selected, disabled, onToggle }: MigrationValueChangeProps) {
  return <Box component="label" sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
    <Checkbox checked={selected} disabled={disabled || !!change.unsupported} onChange={onToggle} />
    <Stack spacing={0.5} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <Typography sx={{ fontWeight: 650 }}>{change.owner}{change.field ? ` · ${change.field}` : ""}</Typography>
      <Typography variant="body2">Java: {display(change.javaValue)}</Typography>
      <Typography variant="body2">Saved: {display(change.savedValue)}</Typography>
      <Typography variant="caption" color={change.unsupported ? "warning.main" : "text.secondary"}>{change.unsupported ?? change.source}</Typography>
    </Stack>
  </Box>;
}
