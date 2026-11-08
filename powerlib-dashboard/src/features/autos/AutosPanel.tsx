import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { dashboardModel } from "../dashboard/dashboardModel";
import { useDashboardSettings } from "../dashboard/useDashboardSettings";
import { useFieldLayout } from "../field/useFieldLayout";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { createAuto, createStep, hasErrors, type AutoRoutine, type AutoStep, type AutoStepType } from "./autoModel";
import { useAutoEditor } from "./useAutoEditor";
import { AutoRoutineList } from "./components/AutoRoutineList";
import { AutoStepsPane } from "./components/AutoStepsPane";
import { AutoEditorField } from "./components/AutoEditorField";

export function AutosPanel() {
  const settings = useDashboardSettings();
  const layout = useFieldLayout();
  const field = layout ?? settings;
  const editor = useAutoEditor(field);
  const [autoId, setAutoId] = useState<string | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "reload" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const topics = useTopics("dashboard");
  const { status } = useNetworkTables();
  const [now, setNow] = useState(performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(timer); }, []);
  const pose = dashboardModel(topics, status === "connected", now).pose;
  const auto = editor.document.autos.find(candidate => candidate.id === autoId);
  const deleteAuto = editor.document.autos.find(candidate => candidate.id === deleteId);
  useEffect(() => {
    if (!auto) { setAutoId(editor.document.autos[0]?.id ?? null); setStepId(null); }
  }, [auto, editor.document.autos]);

  function updateAuto(changes: Partial<AutoRoutine>) {
    editor.setDocument(document => ({ ...document, autos: document.autos.map(candidate => candidate.id === autoId ? { ...candidate, ...changes } : candidate) }));
  }
  function updateStep(step: AutoStep) {
    if (auto) updateAuto({ steps: auto.steps.map(candidate => candidate.id === step.id ? step : candidate) });
  }
  function addStep(type: AutoStepType, point?: { x: number; y: number }, afterId = stepId) {
    if (!auto || editor.readOnly) return;
    let step = createStep(type, editor.project);
    if (step.type === "drive") {
      const previous = (point && auto.steps.find(candidate => candidate.id === afterId && candidate.type === "drive"))
        || auto.steps.filter(candidate => candidate.type === "drive").at(-1);
      step = { ...step, ...(previous?.type === "drive" ? { heading: previous.heading } : {}),
        ...(point ?? (previous?.type === "drive" ? { x: Math.min(field.length, previous.x + 1), y: previous.y } : {})) };
    }
    const steps = [...auto.steps]; const index = steps.findIndex(candidate => candidate.id === afterId);
    steps.splice(index < 0 ? steps.length : index + 1, 0, step);
    updateAuto({ steps }); setStepId(step.id);
  }
  function create() {
    let number = editor.document.autos.length + 1;
    while (editor.document.autos.some(candidate => candidate.name === `Auto ${number}`)) number++;
    const created = createAuto(`Auto ${number}`);
    editor.setDocument(document => ({ ...document, autos: [...document.autos, created] }));
    setAutoId(created.id); setStepId(null);
  }

  return <Box aria-label="Autos editor" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "190px minmax(260px, 1fr) 290px" }, gap: 1.5,
      flex: 1, minHeight: 0, minWidth: 0, overflowY: { xs: "auto", md: "hidden" } }}>
      <AutoRoutineList autos={editor.document.autos} selectedId={autoId} disabled={editor.readOnly} onCreate={create}
        onDelete={id => { setDeleteId(id); setConfirm("delete"); }}
        onSelect={id => { setAutoId(id); setStepId(null); }} />
      <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", minHeight: 0, gap: 1.5, minWidth: 0 }}>
        {auto && <Stack direction="row" spacing={1.5}>
          <TextField label="Auto name" value={auto.name} size="small" disabled={editor.readOnly} sx={{ flex: 1, minWidth: 0 }} slotProps={{ htmlInput: { maxLength: 100 } }} onChange={event => updateAuto({ name: event.target.value })} />
            <TextField select label="Alliance" value={auto.alliance ?? "Any"} size="small" disabled={editor.readOnly} sx={{ minWidth: 130 }} onChange={event => updateAuto({ alliance: event.target.value === "Any" ? null : event.target.value as "Blue" | "Red" })}>
              <MenuItem value="Any">Any alliance</MenuItem><MenuItem value="Blue">Blue</MenuItem><MenuItem value="Red">Red</MenuItem>
            </TextField>
        </Stack>}
        <AutoEditorField auto={auto} layout={layout} dimensions={settings} flip={settings.flip} pose={pose} selectedId={stepId} disabled={editor.readOnly}
          onAdd={(sourceId, point) => addStep("drive", point, sourceId)} onSelect={setStepId} onMove={(id, point) => {
            const step = auto?.steps.find(candidate => candidate.id === id); if (step?.type === "drive") updateStep({ ...step, ...point });
          }} onHeading={(id, heading) => {
            const step = auto?.steps.find(candidate => candidate.id === id); if (step?.type === "drive") updateStep({ ...step, heading });
          }} />
      </Paper>
      <AutoStepsPane auto={auto} selectedId={stepId} states={editor.project.states} disabled={editor.readOnly} onSelect={setStepId}
        footer={<Stack spacing={1} data-auto-save-state={editor.loading ? "loading" : editor.saving || editor.generating ? "saving" : editor.dirty ? "dirty" : "saved"}
          data-auto-code-current={editor.generatedCurrent}>
          {editor.error && <Alert severity="error" sx={{ maxHeight: 160, overflowY: "auto", p: 1 }} action={<Button size="small" disabled={editor.loading || editor.generating}
            onClick={() => { if (editor.dirty) setConfirm("reload"); else void editor.reload(); }}>Reload</Button>}>{editor.error}</Alert>}
          {hasErrors(editor.issues) && <Box sx={{ maxHeight: 110, overflowY: "auto" }}>
            {editor.issues.filter(issue => issue.severity === "error").map((issue, index) => <Typography key={index} variant="caption" component="div" color="error">
              {editor.document.autos.find(candidate => candidate.id === issue.autoId)?.name}: {issue.message}
            </Typography>)}
          </Box>}
          {editor.message && <Typography variant="caption" color="success.main" role="status">{editor.message}</Typography>}
          <Button variant="contained" fullWidth disabled={editor.readOnly || editor.saving || hasErrors(editor.issues) || editor.generatedCurrent || !editor.files?.robotAutosInstalled || !editor.files.driveCommandInstalled}
            onClick={() => void editor.save()}>{editor.generating ? "Saving…" : "Save"}</Button>
        </Stack>}
        onAdd={type => addStep(type)} onChange={updateStep} onRemove={id => {
          if (!auto || editor.readOnly) return;
          const index = auto.steps.findIndex(step => step.id === id);
          updateAuto({ steps: auto.steps.filter(step => step.id !== id) });
          if (id === stepId) setStepId(auto.steps[index - 1]?.id ?? auto.steps[index + 1]?.id ?? null);
        }} />
    <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
      <DialogTitle>{confirm === "delete" ? `Delete ${deleteAuto?.name || "this auto"}?` : "Reload autos from disk?"}</DialogTitle>
      <DialogContent>{confirm === "delete" ? "This removes the routine from the editor. Save to remove it from robot code." : "Your unsaved edits will be discarded."}</DialogContent>
      <DialogActions><Button onClick={() => setConfirm(null)}>Cancel</Button><Button color="error" onClick={() => {
        if (confirm === "delete") editor.setDocument(document => ({ ...document, autos: document.autos.filter(candidate => candidate.id !== deleteId) }));
        else void editor.reload(); setConfirm(null);
      }}>{confirm === "delete" ? "Delete" : "Reload"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
