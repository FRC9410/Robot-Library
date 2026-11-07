import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { StateNameEditor } from "./StateNameEditor";

export function StatesSettings() {
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.resolve().then(() => {
      if (!window.powerlib?.readStateConfig) throw Error("PowerLib file bridge is not available.");
      return window.powerlib.readStateConfig();
    }).then(result => { if (active) setStates(result.config.states); })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Could not load states."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  async function save(next: string[]) {
    if (!window.powerlib?.saveStateConfig) throw Error("PowerLib file bridge is not available.");
    setSaving(true);
    setSaved(false);
    try {
      const result = await window.powerlib.saveStateConfig({ states: next });
      setStates(result.config.states);
      setEditing(null);
      setError("");
      setSaved(true);
    } finally { setSaving(false); }
  }
  async function remove(index: number) {
    try { await save(states.filter((_, current) => current !== index)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete state."); }
  }
  function editor(index: number | "new") {
    return <StateNameEditor name={index === "new" ? "" : states[index]} others={states.filter((_, current) => current !== index)} saving={saving}
      onCancel={() => setEditing(null)} onSave={name => save(index === "new" ? [...states, name] : states.map((existing, current) => current === index ? name : existing))} />;
  }
  return <Box className="config-content">
    <Box className="config-content-heading"><Typography variant="h5" component="h3">States</Typography></Box>
    <Box className="config-subsystem-list"><Stack spacing={2}>
      {loading ? <Stack direction="row" spacing={1.5} role="status"><CircularProgress size={20} /><Typography>Loading states…</Typography></Stack>
        : <>
          {error && <Alert severity="error" action={<Button color="inherit" disabled={saving} onClick={() => setReload(value => value + 1)}>Reload</Button>}>{error}</Alert>}
          <Box component="section" aria-label="State configuration" className="config-expander" sx={{ p: 2 }}><Stack spacing={2}>
            <Stack divider={<Divider />}>
              {states.map((name, index) => <Box key={name}>
                <Stack direction="row" spacing={1} sx={{ py: 1, alignItems: "center" }}>
                  <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 650, overflowWrap: "anywhere" }}>{name}</Typography>
                  <IconButton aria-label={`Edit ${name}`} disabled={saving || editing !== null} onClick={() => { setEditing(index); setSaved(false); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label={`Delete ${name}`} disabled={saving || editing !== null || states.length === 1} onClick={() => void remove(index)}><DeleteIcon /></IconButton>
                </Stack>
                {editing === index && <Box sx={{ pb: 2 }}>{editor(index)}</Box>}
              </Box>)}
            </Stack>
            {editing === "new" && editor("new")}
            {editing === null && <Box><Button variant="contained" startIcon={<AddIcon />} disabled={saving || !!error}
              onClick={() => { setEditing("new"); setSaved(false); }}>Add State</Button></Box>}
          </Stack></Box>
          {saved && <Alert severity="success">States saved. Use File → Update Code, then build and deploy to apply the state names.</Alert>}
        </>}
    </Stack></Box>
  </Box>;
}
