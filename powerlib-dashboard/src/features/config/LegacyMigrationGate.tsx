import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Stack, Typography } from "@mui/material";
import type { MigrationChange } from "../../../electron/java-config/legacyMigration";
import { MigrationValueChange } from "./MigrationValueChange";

type LegacyMigrationGateProps = { onComplete: () => void };
type Report = { revision: string; files: string[]; changes: MigrationChange[] };

export function LegacyMigrationGate({ onComplete }: LegacyMigrationGateProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDeletes, setConfirmDeletes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    if (!window.powerlib?.readLegacyMigration) return;
    void window.powerlib.readLegacyMigration().then(result => {
      if (active) { setReport(result.files.length ? result : null); setSelected([]); setConfirmDeletes(false); setError(""); }
    }).catch(caught => { if (active) { setError(caught instanceof Error ? caught.message : String(caught)); setReport({ revision: "", files: ["Legacy configuration"], changes: [] }); } });
    return () => { active = false; };
  }, [reload]);
  const destructive = !!report?.changes.some(change => selected.includes(change.id) && change.destructive);
  async function finish() {
    if (!report || !window.powerlib?.applyLegacyMigration) return;
    setSaving(true);
    try {
      await window.powerlib.applyLegacyMigration(report.revision, selected, confirmDeletes);
      setReport(null);
      onComplete();
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setSaving(false); }
  }
  return <Dialog open={!!report} maxWidth="md" fullWidth aria-labelledby="java-migration-title">
    <DialogTitle id="java-migration-title">Move configuration to Java</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Typography>Power Tool now saves directly to Java. Select saved values to bring over. Unselected values keep the current Java. Original configuration and source files are backed up before migration.</Typography>
      {saving && <LinearProgress />}
      {error && <Alert severity="error" action={<Button color="inherit" disabled={saving} onClick={() => setReload(value => value + 1)}>Reload</Button>}>{error}</Alert>}
      {!!report?.changes.length && <Stack direction="row" spacing={1}>
        <Button disabled={saving} onClick={() => setSelected(report.changes.filter(change => !change.unsupported && !change.destructive).map(change => change.id))}>Select saved values</Button>
        <Button disabled={saving} onClick={() => setSelected([])}>Keep Java values</Button>
      </Stack>}
      {report?.changes.map(change => <MigrationValueChange key={change.id} change={change} selected={selected.includes(change.id)} disabled={saving}
        onToggle={() => setSelected(current => current.includes(change.id) ? current.filter(id => id !== change.id) : [...current, change.id])} />)}
      {report && !report.changes.length && !error && <Typography>The saved configuration matches the supported Java values. Finish migration to archive the legacy files.</Typography>}
      {destructive && <FormControlLabel control={<Checkbox checked={confirmDeletes} disabled={saving} onChange={event => setConfirmDeletes(event.target.checked)} />} label="Delete the selected state Java files, including edited execute code." />}
    </Stack></DialogContent>
    <DialogActions><Button variant="contained" disabled={saving || !report?.revision || destructive && !confirmDeletes} onClick={() => void finish()}>{saving ? "Migrating…" : "Finish migration"}</Button></DialogActions>
  </Dialog>;
}
