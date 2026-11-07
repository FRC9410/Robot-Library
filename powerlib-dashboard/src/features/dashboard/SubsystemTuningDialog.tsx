import { useRef, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Drawer, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { tuningModeTopicName } from "../networktables/tuningUtils";
import { mechanismTuningChanges, mechanismTuningValues } from "./mechanismTunables";
import { drivetrainTuningChanges, drivetrainTuningValues } from "./drivetrainTunables";
import type { GeneratedSubsystem } from "../subsystems/types";
import { SaveTunedValuesDialog } from "../networktables/SaveTunedValuesDialog";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";

export function SubsystemTuningDialog({ owner, name, kind = "mechanism", subsystems = [], tuningRequested, onClose }: {
  owner: string; name: string; kind?: "mechanism" | "drivetrain"; subsystems?: GeneratedSubsystem[]; tuningRequested: boolean; onClose: () => void;
}) {
  const { status, clientRef, upsertTopic } = useNetworkTables();
  const topics = useTopics("tuning");
  const [appliedTopics, setAppliedTopics] = useState<Record<string, NtTopicSnapshot>>({});
  const currentTopics = topics.map(topic => {
    const applied = appliedTopics[topic.name];
    return applied && (applied.receivedAt ?? 0) > (topic.receivedAt ?? 0) ? applied : topic;
  });
  const rows = kind === "drivetrain" ? drivetrainTuningValues(currentTopics) : mechanismTuningValues(owner, currentTopics, subsystems);
  const acknowledged = topics.find(topic => topic.name === tuningModeTopicName)?.value === true;
  const writable = status === "connected" && tuningRequested && acknowledged;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const applyingRef = useRef(false);
  const pending = rows.filter(row => drafts[row.key] !== undefined && drafts[row.key] !== row.baseline);
  const available = rows.filter(row => row.writable).length;

  function edit(key: string, value: string) {
    setDrafts(current => ({ ...current, [key]: value }));
    setErrors(current => { const next = { ...current }; delete next[key]; return next; });
    setMessage(null);
  }
  function reset(key: string) {
    setDrafts(current => { const next = { ...current }; delete next[key]; return next; });
    setErrors(current => { const next = { ...current }; delete next[key]; return next; });
    setMessage(null);
  }
  async function apply() {
    if (!writable || applyingRef.current || !pending.length) return;
    const { changes, errors: invalid } = kind === "drivetrain"
      ? drivetrainTuningChanges(currentTopics, drafts) : mechanismTuningChanges(owner, currentTopics, drafts, subsystems);
    setErrors(invalid);
    setMessage(null);
    if (Object.keys(invalid).length) {
      setExpandedGroups(current => ({ ...current, ...Object.fromEntries(rows.filter(row => invalid[row.key]).map(row => [row.group, true])) }));
      return;
    }
    applyingRef.current = true;
    setApplying(true);
    try {
      const results = await Promise.allSettled(changes.map(async change => {
        await clientRef.current.publish(change.topic.name, change.type, change.value);
        const snapshot = { ...change.topic, value: change.value, receivedAt: performance.now() };
        upsertTopic(snapshot);
        return { ...change, snapshot };
      }));
      const successful = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
      setAppliedTopics(current => ({ ...current, ...Object.fromEntries(successful.map(change => [change.topic.name, change.snapshot])) }));
      setDrafts(current => {
        const next = { ...current };
        for (const change of successful) if (next[change.key] === change.draft) delete next[change.key];
        return next;
      });
      const failed = results.filter(result => result.status === "rejected");
      setMessage(failed.length
        ? { severity: "error", text: `Applied ${successful.length} of ${changes.length} settings. The remaining edits are kept; try Apply again.` }
        : { severity: "success", text: `Applied ${successful.length} setting${successful.length === 1 ? "" : "s"} to ${name}.` });
    } finally { applyingRef.current = false; setApplying(false); }
  }

  return <><Drawer open anchor="right" onClose={() => { if (!applying && !saveOpen) onClose(); }}
    sx={{ zIndex: theme => theme.zIndex.modal }}
    slotProps={{ paper: { role: "dialog", "aria-modal": true, "aria-labelledby": "mechanism-tuning-title",
      sx: { width: 336, maxWidth: "100vw", top: 40, height: "calc(100% - 40px)", boxSizing: "border-box", bgcolor: "#1b1d21", backgroundImage: "none", borderLeft: 1, borderColor: "divider", colorScheme: "dark" } } }}>
    <DialogTitle id="mechanism-tuning-title" sx={{ display: "flex", alignItems: "center", gap: 2, px: 1.5 }}>
      <Box sx={{ flex: 1 }}><Typography component="span" variant="h6">{name} tunables</Typography>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>{rows.length} settings · {available} available</Typography></Box>
      <IconButton aria-label="Close subsystem tunables" disabled={applying} onClick={onClose}><CloseIcon /></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ px: 1, py: 1, minHeight: 0 }}>
      <Stack spacing={2}>
        {!writable && <Alert severity="info">{status !== "connected" ? "Connect to the robot to edit tunables."
          : !tuningRequested ? "Enable Tuning in the app header to edit these settings." : "Waiting for the robot to acknowledge tuning."}</Alert>}
        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        <Box>
          {[...new Set(rows.map(row => row.group))].map(group => <Accordion key={group} disableGutters square
            expanded={expandedGroups[group] ?? false} onChange={(_, expanded) => setExpandedGroups(current => ({ ...current, [group]: expanded }))}
            slotProps={{ transition: { unmountOnExit: true } }} sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", "&:before": { display: "none" }, mb: 1.5 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`mechanism-${group.replace(/\s/g, "-")}-content`} id={`mechanism-${group.replace(/\s/g, "-")}-heading`}>
              <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700 }}>{group}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2, alignSelf: "center" }}>{rows.filter(row => row.group === group).length} settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
            <Stack spacing={2}>{rows.filter(row => row.group === group).map(row => <Stack key={row.key} direction="row" spacing={0.5} sx={{ alignItems: "flex-start" }}>
              {row.boolean ? <Box sx={{ flex: 1 }}><FormControlLabel label={row.label}
                control={<Switch checked={(drafts[row.key] ?? row.baseline) === "true"} disabled={!writable || !row.writable || applying}
                  onChange={event => edit(row.key, String(event.target.checked))} />} />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{row.writable ? `Live: ${row.topic!.value ? "On" : "Off"}` : "Not published"}</Typography></Box>
                : <TextField label={row.label} type={row.string ? "text" : "number"} size="small" fullWidth
                  value={drafts[row.key] ?? (row.writable ? row.baseline : "")} disabled={!writable || !row.writable || applying}
                  placeholder="Not published" error={!!errors[row.key]} helperText={errors[row.key] || (row.writable ? `Live: ${row.baseline}` : "Not published")}
                  slotProps={{ htmlInput: { step: "any", min: row.min, max: row.max } }} onChange={event => edit(row.key, event.target.value)} />}
              <Tooltip title="Reset pending edit"><span><IconButton size="small" aria-label={`Reset ${row.label}`}
                disabled={applying || drafts[row.key] === undefined} onClick={() => reset(row.key)}><RefreshIcon fontSize="small" /></IconButton></span></Tooltip>
            </Stack>)}</Stack>
            </AccordionDetails>
          </Accordion>)}
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 1.5, py: 1.5, flexWrap: "wrap", gap: 1, "& > :not(style) ~ :not(style)": { ml: 0 } }}>
      <Button variant="outlined" disabled={applying || !!pending.length || !available || !window.powerlib?.readLocalizationConfig}
        onClick={() => setSaveOpen(true)}>Save tuned values</Button>
      <Button disabled={applying} onClick={onClose}>Close</Button>
      <Button variant="contained" disabled={!writable || !pending.length || applying} onClick={() => void apply()}>{applying ? "Applying…" : `Apply${pending.length ? ` (${pending.length})` : ""}`}</Button>
    </DialogActions>
  </Drawer>
    {saveOpen && <SaveTunedValuesDialog open topics={rows.flatMap(row => row.topic && row.writable ? [row.topic] : [])} onClose={() => setSaveOpen(false)} />}
  </>;
}
