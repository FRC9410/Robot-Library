import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { dashboardModel } from "../dashboard/dashboardModel";
import { useDashboardSettings } from "../dashboard/useDashboardSettings";
import { useFieldLayout } from "../field/useFieldLayout";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { allSteps, createAuto, createId, insertStepsAt, createStep, hasErrors, mirroredAuto, uniquePointName, type AutoRoutine, type AutoStep, type AutoStepType, type DriveStep } from "./autoModel";
import type { useAutoEditor } from "./useAutoEditor";
import { AutoRoutineList } from "./components/AutoRoutineList";
import { AutoStepsPane } from "./components/AutoStepsPane";
import { AutoEditorField } from "./components/AutoEditorField";
import { useAutoTools } from "./useAutoTools";
import { AutoEditingDialogs, AutoGroupInspector } from "./components/AutoEditingTools";
import { useAutoColumns } from "./components/AutoColumnSplitter";
import { duplicateAuto } from "./autoEditing";
import { DuplicateAutoDialog } from "./components/DuplicateAutoDialog";
import { NamedPointEditor } from "./components/NamedPointEditor";

export function AutosPanel({ editor }: { editor: ReturnType<typeof useAutoEditor> }) {
  const settings = useDashboardSettings();
  const layout = useFieldLayout();
  const field = layout ?? settings;
  const [autoId, setAutoId] = useState<string | null>(null);
  const [view, setView] = useState<"routines" | "points">("routines");
  const [pointId, setPointId] = useState<string | null>(null);
  const [pointTemplate] = useState(() => createStep("drive", editor.project) as DriveStep);
  const [pointAutoTemplate] = useState(() => createAuto("Named points"));
  const [confirm, setConfirm] = useState<"delete" | "reload" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const topics = useTopics("dashboard");
  const { status } = useNetworkTables();
  const [now, setNow] = useState(performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(timer); }, []);
  const pose = dashboardModel(topics, status === "connected", now).pose;
  const sourceAuto = editor.document.autos.find(candidate => candidate.id === autoId);
  const tools = useAutoTools(editor, sourceAuto, field, view === "routines");
  const auto = tools.displayed, stepId = tools.primary;
  const columns = useAutoColumns();
  const selectedStep = allSteps(auto?.steps ?? []).find(step => step.id === stepId);
  const deleteAuto = editor.document.autos.find(candidate => candidate.id === deleteId);
  const point = editor.document.points.find(point => point.id === pointId);
  const pointAuto: AutoRoutine = { ...pointAutoTemplate, steps: editor.document.points.map(point => ({ ...pointTemplate, ...point })) };
  useEffect(() => {
    if (!auto) { setAutoId(editor.document.autos[0]?.id ?? null); tools.setIds([]); }
  }, [auto, editor.document.autos]);
  useEffect(() => {
    if (pointId && !point) setPointId(editor.document.points[0]?.id ?? null);
  }, [pointId, point, editor.document.points]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (view !== "points" || event.defaultPrevented || editor.readOnly || tools.dialog || document.querySelector('[role="dialog"], [role="menu"]')
          || !document.querySelector('[aria-label="Autos editor"]')?.getClientRects().length) return;
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (command && key === "s") { event.preventDefault(); void editor.save(); return; }
      if (key === "escape") { event.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); setPointId(null); return; }
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (command && ["z", "y"].includes(key)) { event.preventDefault(); if (key === "y" || event.shiftKey) editor.history.redo(); else editor.history.undo(); }
      else if (pointId && ["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); tools.deletePoint(pointId); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });

  function updateAuto(changes: Partial<AutoRoutine>) {
    tools.update(candidate => ({ ...candidate, ...changes }));
  }
  function updateStep(step: AutoStep) {
    tools.change(step);
  }
  function addStep(type: AutoStepType, point?: { x: number; y: number }, afterId = stepId) {
    if (!auto || editor.readOnly) return;
    let step = createStep(type, editor.project);
    if (step.type === "drive") {
      const previous = (point && allSteps(auto.steps).find(candidate => candidate.id === afterId && candidate.type === "drive"))
        || (tools.route?.steps ?? []).filter(candidate => candidate.type === "drive").at(-1);
      step = { ...step, ...(previous?.type === "drive" ? { heading: previous.heading } : {}),
        ...(point ?? (previous?.type === "drive" ? { x: Math.min(field.length, previous.x + 1), y: previous.y } : {})) };
    }
    const steps = insertStepsAt(auto.steps, tools.insertionTarget(afterId), [step]);
    updateAuto({ steps }); tools.setIds([step.id]);
  }
  function create() {
    let number = editor.document.autos.length + 1;
    while (editor.document.autos.some(candidate => candidate.name === `Auto ${number}`)) number++;
    const created = createAuto(`Auto ${number}`);
    editor.setDocument(document => ({ ...document, autos: [...document.autos, created] }));
    setAutoId(created.id); tools.setIds([]);
  }

  const saveFooter = <Stack spacing={1} data-auto-save-state={editor.loading ? "loading" : editor.saving || editor.generating ? "saving" : editor.dirty ? "dirty" : "saved"}
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
        </Stack>;

  return <Box ref={columns.container} aria-label="Autos editor" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: columns.template }, rowGap: 1.5,
      flex: 1, minHeight: 0, minWidth: 0, overflowY: { xs: "auto", md: "hidden" } }}>
      <AutoRoutineList autos={editor.document.autos} selectedId={autoId} disabled={editor.readOnly} onCreate={create}
        view={view} onView={setView} points={editor.document.points} selectedPointId={pointId} onSelectPoint={setPointId}
        onCreatePoint={() => { const created = { id: createId(), name: uniquePointName(editor.document), x: 0, y: 0, heading: 0 }; tools.named(created); setPointId(created.id); }}
        onDeletePoint={tools.deletePoint}
        onDuplicate={() => setDuplicating(true)}
        onDelete={id => { setDeleteId(id); setConfirm("delete"); }}
        onSelect={id => { setAutoId(id); tools.setIds([]); }} />
      {columns.splitter(0)}
      <Paper aria-label="Auto field card" variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", minHeight: 0, gap: 1.5, minWidth: 0 }}>
        {view === "routines" && auto && <Stack direction="row" spacing={1.5}>
          <TextField label="Auto name" value={auto.name} size="small" disabled={editor.readOnly} sx={{ flex: 1, minWidth: 0 }} slotProps={{ htmlInput: { maxLength: 100 } }} onChange={event => updateAuto({ name: event.target.value })} />
            <TextField select label="Alliance" value={auto.alliance ?? "Any"} size="small" disabled={editor.readOnly} sx={{ minWidth: 130 }} onChange={event => updateAuto({ alliance: event.target.value === "Any" ? null : event.target.value as "Blue" | "Red" })}>
              <MenuItem value="Any">Any alliance</MenuItem><MenuItem value="Blue">Blue</MenuItem><MenuItem value="Red">Red</MenuItem>
            </TextField>
        </Stack>}
        <AutoEditorField auto={view === "routines" ? tools.route : pointAuto} layout={layout} dimensions={settings} flip={settings.flip} pose={view === "routines" ? pose : undefined}
          selectedId={view === "routines" ? stepId : pointId} selectedIds={view === "routines" ? tools.ids : pointId ? [pointId] : []} disabled={editor.readOnly}
          connectPoints={view === "routines"} allowCreation={view === "routines"} pointNames={view === "points" ? Object.fromEntries(editor.document.points.map(point => [point.id, point.name])) : undefined}
          snap namedPoints={view === "routines" ? tools.namedPoints : []} onSelection={ids => { if (view === "routines") tools.setIds(ids); else setPointId(ids.at(-1) ?? null); }}
          onBegin={editor.history.beginGesture} onEnd={editor.history.endGesture}
          onAdd={(sourceId, point) => addStep("drive", point, sourceId)} onSelect={(id, mode, preserve) => { if (view === "routines") tools.select(id, mode, preserve); else setPointId(id); }} onMove={(id, position) => {
            if (view === "points") { const named = editor.document.points.find(point => point.id === id); if (named) tools.named({ ...named, ...position }); return; }
            const step = allSteps(auto?.steps ?? []).find(candidate => candidate.id === id); if (step?.type === "drive") tools.translate(position.x - step.x, position.y - step.y);
          }} onFace={(id, point) => {
            const step = allSteps(auto?.steps ?? []).find(candidate => candidate.id === id);
            if (step?.type === "drive" && step.turn.mode === "face") updateStep({ ...step, turn: { ...step.turn, ...point, pointId: null } });
          }} onHeading={(id, heading) => {
            if (view === "points") { const named = editor.document.points.find(point => point.id === id); if (named) tools.named({ ...named, heading }); return; }
            const step = allSteps(auto?.steps ?? []).find(candidate => candidate.id === id); if (step?.type === "drive") updateStep({ ...step, heading });
          }} />
      </Paper>
      {columns.splitter(1)}
      {view === "points" ? <NamedPointEditor point={point} points={editor.document.points} disabled={editor.readOnly} onChange={tools.named} footer={saveFooter} />
      : <AutoStepsPane auto={auto} selectedId={stepId} selectedIds={tools.ids} states={editor.project.states} checks={editor.project.checks ?? []} points={editor.document.points} branches={tools.branches} onShowBranch={tools.showBranch} disabled={editor.readOnly} onSelect={tools.select}
        onClear={() => tools.setIds([])}
        onUndo={editor.history.undo} onRedo={editor.history.redo} canUndo={editor.history.canUndo} canRedo={editor.history.canRedo}
        onDuplicate={tools.duplicateStep} groupInspector={<AutoGroupInspector tools={tools} />} onDrop={tools.drop}
        pointSettings={selectedStep?.type === "drive" && <Stack spacing={1}>
          <TextField select label="Named point" size="small" value={selectedStep.pointId ?? ""} disabled={editor.readOnly} onChange={event => tools.link(event.target.value || null)}>
            <MenuItem value="">None</MenuItem>{editor.document.points.map(point => <MenuItem key={point.id} value={point.id}>{point.name}</MenuItem>)}
          </TextField><Button disabled={editor.readOnly} onClick={tools.savePoint}>Save as named point</Button>
        </Stack>}
        footer={saveFooter}
        onAdd={type => addStep(type)} onChange={updateStep} onRemove={id => {
          if (!auto || editor.readOnly) return;
          tools.remove([id]);
        }} />}
    <AutoEditingDialogs tools={tools} editor={editor} />
    {duplicating && sourceAuto && <DuplicateAutoDialog key={sourceAuto.id} auto={sourceAuto} disabled={editor.readOnly} onClose={() => setDuplicating(false)}
      names={[...editor.document.autos.flatMap(auto => [auto.name, mirroredAuto(auto, field)?.name ?? ""]), ...(editor.files?.handWrittenNames ?? [])]}
      onDuplicate={(name, reflection) => {
        const copy = duplicateAuto(sourceAuto, name, reflection, field);
        editor.setDocument(document => ({ ...document, autos: [...document.autos, copy] }));
        setDuplicating(false); setAutoId(copy.id); tools.setIds([]);
      }} />}
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
