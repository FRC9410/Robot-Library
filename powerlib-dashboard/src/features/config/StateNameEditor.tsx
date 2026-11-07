import { useState } from "react";
import { Alert, Box, Button, Stack, TextField } from "@mui/material";
import { validateStateConfig } from "../../../electron/stateConfig";

export function StateNameEditor({ name, others, saving, onSave, onCancel }: {
  name: string; others: string[]; saving: boolean; onSave: (name: string) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState("");
  async function submit() {
    try {
      validateStateConfig({ states: [...others, draft] });
      setError("");
      await onSave(draft);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save state."); }
  }
  return <Box component="form" aria-label="State name editor" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <TextField autoFocus size="small" label="State name" value={draft} disabled={saving} sx={{ flex: 1, minWidth: 0 }}
          onChange={event => { setDraft(event.target.value.toUpperCase()); setError(""); }} />
        <Button type="submit" variant="contained" disabled={saving || !draft} sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>{saving ? "Saving…" : "Save State"}</Button>
        <Button disabled={saving} onClick={onCancel} sx={{ flexShrink: 0 }}>Cancel</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  </Box>;
}
