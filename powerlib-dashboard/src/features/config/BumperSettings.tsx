import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { saveBumperDimensions } from "../dashboard/dashboardSettings";
import { useDashboardSettings } from "../dashboard/useDashboardSettings";
import { defaultBumperDimensions, validBumperDimensions } from "../field/robotFootprint";

export function BumperSettings() {
  const { bumper } = useDashboardSettings();
  const [length, setLength] = useState(String(bumper.lengthInches)), [width, setWidth] = useState(String(bumper.widthInches));
  const [error, setError] = useState(""), [saved, setSaved] = useState(false);
  useEffect(() => { setLength(String(bumper.lengthInches)); setWidth(String(bumper.widthInches)); }, [bumper.lengthInches, bumper.widthInches]);
  const value = { lengthInches: Number(length), widthInches: Number(width) };
  const valid = !!length.trim() && !!width.trim() && validBumperDimensions(value);
  const dirty = value.lengthInches !== bumper.lengthInches || value.widthInches !== bumper.widthInches;
  function save() {
    if (!valid) return;
    try { saveBumperDimensions(value); setError(""); setSaved(true); }
    catch { setError("Could not save bumper dimensions on this laptop."); setSaved(false); }
  }
  return <Box component="section" aria-label="Bumper dimensions" onKeyDown={event => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); save(); }
  }}><Stack spacing={2}>
    <Box><Typography variant="subtitle1" sx={{ fontWeight: 650 }}>Bumper perimeter</Typography>
      <Typography variant="body2" color="text.secondary">Outside dimensions, including bumpers.</Typography></Box>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField fullWidth type="number" label="Bumper length (in)" value={length} error={!length.trim() || !Number.isFinite(Number(length)) || Number(length) <= 0}
        helperText="Front to back" slotProps={{ htmlInput: { min: 0, step: "any" } }} onChange={event => { setLength(event.target.value); setSaved(false); setError(""); }} />
      <TextField fullWidth type="number" label="Bumper width (in)" value={width} error={!width.trim() || !Number.isFinite(Number(width)) || Number(width) <= 0}
        helperText="Left to right" slotProps={{ htmlInput: { min: 0, step: "any" } }} onChange={event => { setWidth(event.target.value); setSaved(false); setError(""); }} />
    </Stack>
    <Stack direction="row" spacing={1}>
      <Button type="button" variant="outlined" disabled={!valid || !dirty} onClick={save}>Save bumper dimensions</Button>
      <Button type="button" onClick={() => { setLength(String(defaultBumperDimensions.lengthInches)); setWidth(String(defaultBumperDimensions.widthInches)); setSaved(false); setError(""); }}>Reset bumper size</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}{saved && <Alert severity="success">Bumper dimensions saved.</Alert>}
  </Stack></Box>;
}
