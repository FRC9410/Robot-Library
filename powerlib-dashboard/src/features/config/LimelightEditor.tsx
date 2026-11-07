import { useState } from "react";
import { Alert, Box, Button, InputAdornment, Stack, TextField } from "@mui/material";
import { defaultLimelightSettings, validateVisionConfig, type LimelightConfig } from "../../../electron/visionConfig";

export function LimelightEditor({ camera, others, saving, onSave, onCancel }: {
  camera: LimelightConfig; others: LimelightConfig[]; saving: boolean;
  onSave: (camera: LimelightConfig) => Promise<void>; onCancel: () => void;
}) {
  const [suffix, setSuffix] = useState(camera.name.replace(/^limelight(?:-|$)/, ""));
  const [error, setError] = useState("");
  async function submit() {
    const next = { name: `limelight-${suffix}` };
    try {
      validateVisionConfig({ ...defaultLimelightSettings, limelights: [...others, next] });
      setError("");
      await onSave(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save Limelight."); }
  }
  return <Box component="form" aria-label="Limelight name editor" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <TextField autoFocus size="small" label="Limelight name" value={suffix} disabled={saving} sx={{ flex: 1, minWidth: 0 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start">limelight-</InputAdornment> } }}
          onChange={event => setSuffix(event.target.value.replace(/^limelight-/i, "").toLowerCase())} />
        <Button type="submit" variant="contained" disabled={saving || !suffix} sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>{saving ? "Saving…" : "Save Limelight"}</Button>
        <Button disabled={saving} onClick={onCancel} sx={{ flexShrink: 0 }}>Cancel</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  </Box>;
}
