import { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { defaultFieldDimensions, saveFieldDimensions, validFieldDimensions } from "../dashboard/dashboardSettings";
import { useDashboardSettings } from "../dashboard/useDashboardSettings";
import { fieldLayouts, noFieldLayout, setFieldLayoutId } from "../field/fieldLayouts";
import { useFieldLayout } from "../field/useFieldLayout";
import { useUploadedField } from "../field/useUploadedField";
import { FieldUpload } from "./FieldUpload";
import { BumperSettings } from "./BumperSettings";

export function FieldSettings() {
  const settings = useDashboardSettings();
  const layout = useFieldLayout();
  const uploaded = useUploadedField();
  const field = layout ?? settings;
  const [length, setLength] = useState(String(settings.length));
  const [width, setWidth] = useState(String(settings.width));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dimensions = { length: Number(length), width: Number(width) };
  const valid = !!length.trim() && !!width.trim() && validFieldDimensions(dimensions);
  const dirty = dimensions.length !== settings.length || dimensions.width !== settings.width;
  useEffect(() => { setLength(String(field.length)); setWidth(String(field.width)); }, [field.length, field.width]);
  useEffect(() => { setSaved(false); setError(""); }, [layout?.id]);
  function save() {
    if (!valid || layout) return;
    try { saveFieldDimensions(dimensions); setError(""); setSaved(true); }
    catch { setError("Could not save field dimensions on this laptop. Your previous dimensions are still in use."); setSaved(false); }
  }
  return <Box component="form" className="config-content" onSubmit={event => { event.preventDefault(); save(); }}>
    <Box className="config-content-heading"><Box>
      <Typography variant="h5" component="h3">Field</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Choose the field used by Dashboard, Autos, and the log viewer.</Typography>
    </Box></Box>
    <Box className="config-field-settings">
      <Stack spacing={3} sx={{ maxWidth: 600 }}>
        <TextField select label="Field layout" value={layout?.id ?? noFieldLayout}
          onChange={event => setFieldLayoutId(event.target.value)}>
          <MenuItem value={noFieldLayout}>None (custom dimensions)</MenuItem>
          {fieldLayouts.map(option => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
          {uploaded && <MenuItem value={uploaded.id}>{uploaded.label} (uploaded)</MenuItem>}
        </TextField>
        <BumperSettings />
        <FieldUpload dimensions={field} />
        <Box><Typography variant="subtitle1" sx={{ fontWeight: 650 }}>Field dimensions</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{layout
            ? "Dimensions come from the selected layout. Choose None to use custom dimensions."
            : "Enter the full field length and width in meters. Coordinates use the blue origin."}</Typography></Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth type="number" label="Field length (m)" value={length} disabled={!!layout}
            error={!length.trim() || !Number.isFinite(Number(length)) || Number(length) <= 0}
            helperText={!length.trim() || !Number.isFinite(Number(length)) || Number(length) <= 0 ? "Enter a positive length." : "Along the X axis"}
            slotProps={{ htmlInput: { min: 0, step: "any" } }} onChange={event => { setLength(event.target.value); setSaved(false); setError(""); }} />
          <TextField fullWidth type="number" label="Field width (m)" value={width} disabled={!!layout}
            error={!width.trim() || !Number.isFinite(Number(width)) || Number(width) <= 0}
            helperText={!width.trim() || !Number.isFinite(Number(width)) || Number(width) <= 0 ? "Enter a positive width." : "Along the Y axis"}
            slotProps={{ htmlInput: { min: 0, step: "any" } }} onChange={event => { setWidth(event.target.value); setSaved(false); setError(""); }} />
        </Stack>
        <Typography variant="body2" color="text.secondary">These display settings are saved on this laptop and shared by Dashboard, its thumbnail, Autos, and log playback.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {saved && <Alert severity="success">Field dimensions saved.</Alert>}
      </Stack>
    </Box>
    <Box className="config-footer">
      <Button type="submit" variant="contained" disabled={!!layout || !valid || !dirty}>Save dimensions</Button>
      <Button disabled={!!layout} onClick={() => { setLength(String(defaultFieldDimensions.length)); setWidth(String(defaultFieldDimensions.width)); setSaved(false); setError(""); }}>Reset to defaults</Button>
    </Box>
  </Box>;
}
