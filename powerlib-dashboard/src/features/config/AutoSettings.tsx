import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import type { useAutoEditor } from "../autos/useAutoEditor";
import { defaultPeriodSeconds, hasErrors } from "../autos/autoModel";

export function AutoSettings({ editor }: { editor: ReturnType<typeof useAutoEditor> }) {
  const [duration, setDuration] = useState(String(editor.document.periodSeconds));
  useEffect(() => setDuration(String(editor.document.periodSeconds)), [editor.document.periodSeconds]);
  const value = Number(duration), valid = !!duration.trim() && Number.isFinite(value) && value > 0;
  function change(next: string) {
    setDuration(next);
    const seconds = Number(next);
    if (next.trim() && Number.isFinite(seconds) && seconds > 0) editor.setDocument(document => ({ ...document, periodSeconds: seconds }));
  }
  return <Box component="form" className="config-content" aria-label="Auto configuration" onSubmit={event => { event.preventDefault(); if (valid) void editor.save(); }}>
    <Box className="config-content-heading"><Typography variant="h5" component="h3">Auto</Typography></Box>
    <Box className="config-field-settings"><Stack spacing={3} sx={{ maxWidth: 600 }}>
      {editor.loading ? <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }} role="status"><CircularProgress size={20} /><Typography>Loading auto settings…</Typography></Stack> : <>
        <TextField label="Autonomous duration (s)" type="number" value={duration} disabled={editor.readOnly} error={!valid}
          helperText={valid ? "Used by remaining-time branches in all routines." : "Enter a positive duration."}
          slotProps={{ htmlInput: { min: 0, step: .1 } }} onChange={event => change(event.target.value)} />
        <Typography variant="body2" color="text.secondary">Save, then rebuild and restart simulation or deploy to apply changes to the robot.</Typography>
      </>}
      {editor.error && <Alert severity="error">{editor.error}</Alert>}
      {hasErrors(editor.issues) && <Alert severity="error">Fix the auto errors in Autos before saving.</Alert>}
      {editor.message && <Alert severity="success" role="status">{editor.message}</Alert>}
    </Stack></Box>
    <Box className="config-footer">
      <Button type="submit" variant="contained" disabled={!valid || editor.readOnly || editor.saving || hasErrors(editor.issues) || editor.generatedCurrent || !editor.files?.robotAutosInstalled || !editor.files.driveCommandInstalled}>
        {editor.generating ? "Saving…" : "Save auto settings"}
      </Button>
      <Button disabled={editor.readOnly} onClick={() => change(String(defaultPeriodSeconds))}>Reset to defaults</Button>
    </Box>
  </Box>;
}
