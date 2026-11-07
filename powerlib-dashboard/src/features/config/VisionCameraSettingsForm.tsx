import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { validateVisionConfig, type VisionConfig, type VisionCameraSettings } from "../../../electron/visionConfig";

export function VisionCameraSettingsForm({ vision, disabled, onSave }: {
  vision: VisionConfig; disabled: boolean; onSave: (settings: VisionCameraSettings) => Promise<void>;
}) {
  const [fov, setFov] = useState(String(vision.fovDegrees));
  const [width, setWidth] = useState(String(vision.imageWidth));
  const [height, setHeight] = useState(String(vision.imageHeight));
  const [error, setError] = useState("");
  useEffect(() => { setFov(String(vision.fovDegrees)); setWidth(String(vision.imageWidth)); setHeight(String(vision.imageHeight)); },
    [vision.fovDegrees, vision.imageWidth, vision.imageHeight]);
  const dirty = Number(fov) !== vision.fovDegrees || Number(width) !== vision.imageWidth || Number(height) !== vision.imageHeight;
  async function submit() {
    const settings = { fovDegrees: Number(fov), imageWidth: Number(width), imageHeight: Number(height) };
    try {
      validateVisionConfig({ ...vision, ...settings });
      setError("");
      await onSave(settings);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save camera settings."); }
  }
  return <Box component="form" aria-label="Global camera settings"
    onSubmit={event => { event.preventDefault(); void submit(); }}>
    <Stack spacing={2}>
      <Box><Typography variant="subtitle1" sx={{ fontWeight: 650 }}>Global camera settings</Typography>
        <Typography variant="body2" color="text.secondary">Shared by all Limelights.</Typography></Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField fullWidth type="number" label="Horizontal FOV (degrees)" value={fov} disabled={disabled}
          slotProps={{ htmlInput: { min: 0, max: 180, step: "any" } }} onChange={event => { setFov(event.target.value); setError(""); }} />
        <TextField fullWidth type="number" label="Image width (px)" value={width} disabled={disabled}
          slotProps={{ htmlInput: { min: 1, step: 1 } }} onChange={event => { setWidth(event.target.value); setError(""); }} />
        <TextField fullWidth type="number" label="Image height (px)" value={height} disabled={disabled}
          slotProps={{ htmlInput: { min: 1, step: 1 } }} onChange={event => { setHeight(event.target.value); setError(""); }} />
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Box><Button type="submit" variant="outlined" disabled={disabled || !dirty || !fov.trim() || !width.trim() || !height.trim()}>Save camera settings</Button></Box>
    </Stack>
  </Box>;
}
