import { memo, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Divider, Drawer, IconButton, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { ConstantsFile } from "../constants/types";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { SaveTunedValuesDialog } from "../networktables/SaveTunedValuesDialog";
import { tuningModeTopicName } from "../networktables/tuningUtils";
import { createTuningValues, formatValue, groupTunables, parseTuningValue, type TuningValue } from "./robotModel";

type Props = {
  groupKey: string; name: string; file?: ConstantsFile; tuningRequested: boolean;
  onClose: () => void; onSaved: (file: ConstantsFile) => void;
};

export const RobotTuningDrawer = memo(function RobotTuningDrawer({ groupKey, name, file, tuningRequested, onClose, onSaved }: Props) {
  const { clientRef, status, upsertTopic } = useNetworkTables();
  const topics = useTopics("tuning");
  const groups = useMemo(() => groupTunables(topics), [topics]);
  const variables = groups.get(groupKey) ?? [];
  const values = createTuningValues(variables, file);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const wide = useMediaQuery(useTheme().breakpoints.up("md"));
  const tuningEnabled = tuningRequested && topics.find(topic => topic.name === tuningModeTopicName)?.value === true;
  const liveWritable = status === "connected" && tuningEnabled;
  const canEdit = (value: TuningValue) => !applying && (value.topic ? liveWritable : Boolean(window.powerlib?.saveConstants));
  const pending = values.filter(value => drafts[value.id] !== undefined && drafts[value.id] !== value.baseline);
  const editablePending = pending.filter(canEdit);
  const visible = values.filter(value => value.label.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => { setSearch(""); setError(null); setMessage(null); }, [groupKey]);

  function reset(value: TuningValue) {
    setDrafts(current => {
      const next = { ...current };
      delete next[value.id];
      return next;
    });
    setErrors(current => {
      const next = { ...current };
      delete next[value.id];
      return next;
    });
    setError(null); setMessage(null);
  }

  async function apply() {
    if (applying || !editablePending.length) return;
    const changes: { value: TuningValue; draft: string; parsed: ReturnType<typeof parseTuningValue> }[] = [];
    const invalid: Record<string, string> = {};
    for (const value of editablePending) {
      try { changes.push({ value, draft: drafts[value.id], parsed: parseTuningValue(value, drafts[value.id]) }); }
      catch (caught) { invalid[value.id] = caught instanceof Error ? caught.message : String(caught); }
    }
    setErrors(invalid); setError(null); setMessage(null);
    if (Object.keys(invalid).length) { setError("Fix the invalid values before applying."); return; }
    setApplying(true);
    const applied = new Map<string, string>();
    try {
      const savedChanges = changes.filter(change => !change.value.topic);
      if (savedChanges.length && file) {
        const replacements = new Map(savedChanges.map(change => [change.value.constant!.name, change.parsed.saved!]));
        const constants = file.constants.map(row => replacements.has(row.name) ? { ...row, value: replacements.get(row.name)! } : row);
        const saved = await window.powerlib!.saveConstants(file.id, file.source, constants);
        if (saved.error) throw new Error(saved.error);
        onSaved(saved);
        savedChanges.forEach(change => applied.set(change.value.id, change.draft));
        setMessage(`Saved ${name} defaults. Run Update Code, rebuild, and deploy to use them.`);
      }
      const liveChanges = changes.filter(change => change.value.topic);
      const results = await Promise.allSettled(liveChanges.map(async change => {
        const topic = change.value.topic!;
        await clientRef.current.publish(topic.name, change.parsed.type!, change.parsed.live!);
        upsertTopic({ ...topic, type: change.parsed.type!, value: change.parsed.live!, lastChangedTime: Date.now() });
        applied.set(change.value.id, change.draft);
      }));
      const failed = results.filter(result => result.status === "rejected");
      if (failed.length) {
        const reason = failed[0].reason;
        setError(`Applied ${applied.size} of ${changes.length} values for ${name}. ${reason instanceof Error ? reason.message : "Could not publish values."}`);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not apply values."); }
    finally {
      setDrafts(current => {
        const next = { ...current };
        for (const [id, draft] of applied) if (next[id] === draft) delete next[id];
        return next;
      });
      setApplying(false);
    }
  }

  return <>
    <Drawer anchor="right" variant={wide ? "persistent" : "temporary"} open onClose={onClose}
      sx={{ width: wide ? 360 : undefined, minHeight: 0, flexShrink: 0, "& .MuiDrawer-paper": { width: { xs: "min(100vw, 400px)", md: 360 }, position: wide ? "relative" : undefined, height: "100%", minHeight: 0, overflow: "hidden", boxSizing: "border-box" } }}>
      <Stack component="aside" aria-label={`${name} tunables`} spacing={1.5} useFlexGap sx={{ p: 2, height: "100%", minHeight: 0, boxSizing: "border-box" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Box><Typography variant="h6">{name}</Typography><Typography variant="body2" color="text.secondary">{values.length} value{values.length === 1 ? "" : "s"}</Typography></Box>
          <IconButton aria-label="Close tunables" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        {file?.error && <Alert severity="warning">{file.error}</Alert>}
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {message && <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert>}
        <TextField size="small" placeholder="Search variables" slotProps={{ htmlInput: { "aria-label": "Search tunables" } }} value={search} onChange={event => setSearch(event.target.value)} />
        <Divider />
        <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto", pt: 1, mr: -2, pr: 2 }}>
          {visible.map(value => <Stack key={value.id} direction="row" spacing={0.5} sx={{ alignItems: "flex-start" }}>
            <TextField label={value.label} size="small" fullWidth disabled={!canEdit(value)} error={Boolean(errors[value.id])}
              sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { py: 0.75 } }}
              helperText={errors[value.id] || (value.topic ? `Live: ${formatValue(value.topic.value)}` : undefined)}
              value={drafts[value.id] ?? value.baseline} slotProps={{ htmlInput: { "aria-label": value.label } }}
              onChange={event => { setDrafts(current => ({ ...current, [value.id]: event.target.value })); setErrors(current => ({ ...current, [value.id]: "" })); }} />
            <Tooltip title="Reset"><span><IconButton size="small" aria-label={`Reset ${value.label}`}
              disabled={applying || drafts[value.id] === undefined || drafts[value.id] === value.baseline}
              onClick={() => reset(value)}><RefreshIcon fontSize="small" /></IconButton></span></Tooltip>
          </Stack>)}
          {!visible.length && <Alert severity="info">{values.length ? "No values match that search." : "No values are available for this group yet."}</Alert>}
        </Stack>
        <Button variant="contained" fullWidth disabled={!editablePending.length} onClick={() => void apply()}>{applying ? "Applying" : `Apply${editablePending.length ? ` (${editablePending.length})` : ""}`}</Button>
        <Button variant="outlined" disabled={!variables.length || !window.powerlib?.readSubsystems} onClick={() => setSaveOpen(true)}>Save tuned values</Button>
      </Stack>
    </Drawer>
    <SaveTunedValuesDialog open={saveOpen} topics={variables} onClose={() => setSaveOpen(false)} />
  </>;
});
