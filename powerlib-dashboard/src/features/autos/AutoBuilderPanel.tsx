import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { driveModel, template } from "../drive/driveModel";
import { useFieldLayout } from "../field/fieldLayouts";
import { AutoField } from "./AutoField";
import { AutoReplayBar } from "./AutoReplayBar";
import { StepInspector, StepList, stepDescriptions, stepIcons } from "./AutoSteps";
import type { LegReplayInfo } from "./AutoSteps";
import {
  createAuto,
  createId,
  createStep,
  emptyDocument,
  flipPoint,
  flipSteps,
  generateAutosJava,
  hasErrors,
  legConstraints,
  mirroredAuto,
  parseAutoDocument,
  stepLabels,
  validateAutos
} from "./autoModel";
import type { AutoDocument, AutoProject, AutoRoutine, AutoStep, AutoStepType, DriveStep, LegConstraints, Symmetry } from "./autoModel";
import { frameAt, replayAuto, segmentAt, stateAt } from "./autoReplay";
import "./autos.css";
import "./autoBuilder.css";

type FilesState = {
  loading: boolean;
  path: string;
  states: string[];
  driveCommandInstalled: boolean | null;
  robotAutosHooked: boolean | null;
  robotAutosStrings: string[];
  robot: { width: number; length: number };
  error: string | null;
};

type Message = { severity: "success" | "error" | "info" | "warning"; text: string };

const stateColors = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#2dd4bf", "#f87171", "#fde047"];

/** Without a View → Field Layout choice, uses the field size from Drive crew tools so both views agree. */
function readFieldSize() {
  const fallback = { length: template.field.lengthMeters, width: template.field.widthMeters };
  try {
    const value = JSON.parse(localStorage.getItem("powerlib.driveDisplay.v1") || "{}");
    return { length: Number.isFinite(value.length) && value.length > 0 ? value.length : fallback.length,
      width: Number.isFinite(value.width) && value.width > 0 ? value.width : fallback.width };
  } catch {
    return fallback;
  }
}

const previousDrive = (steps: AutoStep[], beforeIndex: number) =>
  steps.slice(0, beforeIndex).reverse().find((step): step is DriveStep => step.type === "drive");

export function AutoBuilderPanel() {
  const api = window.powerlib;
  const { status } = useNetworkTables();
  const topics = useTopics("drive");
  const [now, setNow] = useState(() => performance.now());
  const [files, setFiles] = useState<FilesState>({ loading: true, path: "", states: [], driveCommandInstalled: null,
    robotAutosHooked: null, robotAutosStrings: [], robot: { width: 0.914, length: 0.914 }, error: null });
  const [document, setDocument] = useState<AutoDocument>(emptyDocument);
  const [savedJson, setSavedJson] = useState(JSON.stringify(emptyDocument()));
  const [selectedAutoId, setSelectedAutoId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "update" | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [view, setView] = useState<"field" | "code">("field");
  const [showMirror, setShowMirror] = useState(false);
  const [replayTime, setReplayTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);
  const [autoMenu, setAutoMenu] = useState<HTMLElement | null>(null);
  const layout = useFieldLayout();
  const field = useMemo(() => layout ? { length: layout.length, width: layout.width } : readFieldSize(), [layout]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  const livePose = driveModel(topics, status === "connected", now).pose;

  const project: AutoProject = useMemo(() => ({ states: files.states, driveCommandInstalled: files.driveCommandInstalled, field,
    handWrittenNames: files.robotAutosStrings }), [files.states, files.driveCommandInstalled, files.robotAutosStrings, field]);
  const issues = useMemo(() => validateAutos(document, project), [document, project]);
  const dirty = JSON.stringify(document) !== savedJson;
  const errorCount = issues.filter(issue => issue.severity === "error").length;
  const auto = document.autos.find(candidate => candidate.id === selectedAutoId) ?? null;
  const mirror = useMemo(() => auto ? mirroredAuto(auto, field) : null, [auto, field]);
  const viewingMirror = showMirror && mirror !== null;
  const shownAuto = viewingMirror ? mirror : auto;
  const replay = useMemo(() => replayAuto(shownAuto ?? createAuto("")), [shownAuto]);
  const allReplays = useMemo(() => new Map(document.autos.map(candidate => [candidate.id, replayAuto(candidate).duration])), [document.autos]);
  const stateColor = useCallback((state: string | null) => {
    const index = state === null ? -1 : files.states.indexOf(state);
    return index < 0 ? "#94a3b8" : stateColors[index % stateColors.length];
  }, [files.states]);

  // Replay drives the field robot; the live robot is shown otherwise.
  const frame = replayTime === null ? undefined : frameAt(replay, replayTime);
  const fieldPose = frame ? { x: frame.x, y: frame.y, heading: frame.heading } : livePose;
  const activeSegment = replayTime === null ? undefined : segmentAt(replay, replayTime);
  const activeStepId = activeSegment && activeSegment.stepId !== "clear" ? activeSegment.stepId : null;
  const replayState = replayTime === null ? null : stateAt(replay, replayTime);
  const durations = useMemo(() => new Map(replay.segments.map(segment => [segment.stepId, segment.end - segment.start])), [replay]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frameId = 0;
    const tick = (timestamp: number) => {
      const elapsed = (timestamp - last) / 1000 * replaySpeed;
      last = timestamp;
      let finished = false;
      setReplayTime(current => {
        const next = (current ?? 0) + elapsed;
        if (next >= replay.duration) { finished = true; return replay.duration; }
        return next;
      });
      if (finished) setPlaying(false);
      else frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, replaySpeed, replay.duration]);

  // Keep the playhead valid when edits shorten the auto.
  useEffect(() => {
    setReplayTime(current => current === null ? null : Math.min(current, replay.duration));
  }, [replay.duration]);

  const stopReplay = () => { setPlaying(false); setReplayTime(null); };

  const applyFiles = (state: Awaited<ReturnType<NonNullable<typeof api>["readAutos"]>>) => {
    setFiles({ loading: false, path: state.path, states: state.states, driveCommandInstalled: state.driveCommandInstalled,
      robotAutosHooked: state.robotAutosHooked, robotAutosStrings: state.robotAutosStrings ?? [], robot: state.robot, error: state.error ?? null });
  };

  const load = useCallback(async () => {
    if (!api) {
      setFiles(current => ({ ...current, loading: false, error: "Open the Auto Builder in Power Tool to load and save robot autos." }));
      return;
    }
    setFiles(current => ({ ...current, loading: true }));
    try {
      const state = await api.readAutos();
      applyFiles(state);
      const next = parseAutoDocument(state.document);
      setDocument(next);
      setSavedJson(JSON.stringify(next));
      setSelectedAutoId(current => next.autos.some(candidate => candidate.id === current) ? current : next.autos[0]?.id ?? null);
      setSelectedStepId(null);
    } catch (error) {
      setFiles(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Could not read autos." }));
    }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const updateAuto = (id: string, update: (auto: AutoRoutine) => AutoRoutine) => {
    setDocument(current => ({ ...current, autos: current.autos.map(candidate => candidate.id === id ? update(candidate) : candidate) }));
  };
  const updateSelected = (update: (auto: AutoRoutine) => AutoRoutine) => { if (auto) updateAuto(auto.id, update); };
  const updateStep = (stepId: string, patch: Partial<AutoStep>) => {
    updateSelected(current => ({ ...current, steps: current.steps.map(step => step.id === stepId ? { ...step, ...patch } as AutoStep : step) }));
  };

  /** New steps go after the selected step so an auto is built in order. */
  const insertStep = (step: AutoStep) => {
    updateSelected(current => {
      const index = current.steps.findIndex(candidate => candidate.id === selectedStepId);
      const steps = [...current.steps];
      steps.splice(index < 0 ? steps.length : index + 1, 0, step);
      return { ...current, steps };
    });
    setSelectedStepId(step.id);
  };
  const insertionIndex = () => {
    if (!auto) return 0;
    const index = auto.steps.findIndex(candidate => candidate.id === selectedStepId);
    return index < 0 ? auto.steps.length : index + 1;
  };
  /** A new leg starts from the previous leg's pose and limits, so long autos need few edits. */
  const newDriveStep = (x?: number, y?: number): DriveStep => {
    const previous = auto ? previousDrive(auto.steps, insertionIndex()) : undefined;
    const base = createStep("drive", project) as DriveStep;
    return { ...base, ...(previous ? { x: previous.x, y: previous.y, heading: previous.heading, ...legConstraints(previous) } : {}),
      ...(x !== undefined && y !== undefined ? { x, y } : {}) };
  };
  const addStep = (type: AutoStepType) => insertStep(type === "drive" ? newDriveStep() : createStep(type, project));

  // In the mirrored view, field edits are flipped back onto the original auto.
  const fieldAddPoint = (x: number, y: number) => {
    if (!auto) return;
    const point = viewingMirror ? flipPoint({ x, y, heading: 0 }, auto.symmetry, field) : { x, y };
    insertStep(newDriveStep(point.x, point.y));
  };
  const fieldChangePoint = (stepId: string, patch: Partial<Pick<DriveStep, "x" | "y" | "heading">>) => {
    if (!viewingMirror || !auto || !mirror) { updateStep(stepId, patch); return; }
    const shown = mirror.steps.find((step): step is DriveStep => step.id === stepId && step.type === "drive");
    if (!shown) return;
    const original = flipPoint({ ...shown, ...patch }, auto.symmetry, field);
    updateStep(stepId, { x: original.x, y: original.y, heading: original.heading });
  };
  // Subpoint progress is a fraction of the leg, so it is the same in the mirrored view.
  const changeSubpoint = (stepId: string, subpointId: string, progress: number) => {
    updateSelected(current => ({ ...current, steps: current.steps.map(step => step.id === stepId && step.type === "drive"
      ? { ...step, subpoints: step.subpoints.map(subpoint => subpoint.id === subpointId ? { ...subpoint, progress } : subpoint) }
      : step) }));
  };

  const moveStep = (stepId: string, offset: number) => {
    updateSelected(current => {
      const index = current.steps.findIndex(step => step.id === stepId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.steps.length) return current;
      const steps = [...current.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
  };
  const deleteStep = (stepId: string) => {
    updateSelected(current => ({ ...current, steps: current.steps.filter(step => step.id !== stepId) }));
    if (selectedStepId === stepId) setSelectedStepId(null);
  };
  const applyLimitsToAll = (limits: LegConstraints) => {
    updateSelected(current => ({ ...current, steps: current.steps.map(step => step.type === "drive" ? { ...step, ...limits } : step) }));
    setMessage({ severity: "success", text: "Applied these limits to every drive step in this auto." });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!selectedStepId || target?.closest("input, textarea, [contenteditable='true'], [role='combobox'], [role='listbox']")) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteStep(selectedStepId);
      } else if (event.key === "Escape") {
        setSelectedStepId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectAuto = (id: string | null) => {
    setSelectedAutoId(id);
    setSelectedStepId(null);
    setShowMirror(false);
    stopReplay();
  };
  const newAuto = () => {
    const names = new Set(document.autos.map(candidate => candidate.name));
    let number = document.autos.length + 1;
    while (names.has(`Auto ${number}`)) number++;
    const next = createAuto(`Auto ${number}`);
    setDocument(current => ({ ...current, autos: [...current.autos, next] }));
    selectAuto(next.id);
  };
  const duplicateAuto = () => {
    if (!auto) return;
    const copy: AutoRoutine = { ...auto, id: createId(), name: `${auto.name} copy`, isDefault: false,
      steps: auto.steps.map(step => step.type === "drive"
        ? { ...step, id: createId(), subpoints: step.subpoints.map(subpoint => ({ ...subpoint, id: createId() })) }
        : { ...step, id: createId() }) };
    setDocument(current => ({ ...current, autos: [...current.autos, copy] }));
    selectAuto(copy.id);
  };
  const deleteAuto = () => {
    if (!auto || !window.confirm(`Delete "${auto.name}"? It is removed from robot code on the next Update code.`)) return;
    const remaining = document.autos.filter(candidate => candidate.id !== auto.id);
    setDocument(current => ({ ...current, autos: remaining }));
    selectAuto(remaining[0]?.id ?? null);
  };
  const setDefault = (checked: boolean) => {
    if (!auto) return;
    setDocument(current => ({ ...current, autos: current.autos.map(candidate => ({ ...candidate,
      isDefault: candidate.id === auto.id ? checked : checked ? false : candidate.isDefault })) }));
  };
  const flipInPlace = (flips: Symmetry) => {
    updateSelected(current => ({ ...current, steps: flipSteps(current.steps, flips, field) }));
    setAutoMenu(null);
  };

  const save = async () => {
    if (!api) return;
    setBusy("save");
    try {
      applyFiles(await api.saveAutos(document));
      setSavedJson(JSON.stringify(document));
      setMessage({ severity: "success", text: "Saved. Use Update code to write the autos into robot code." });
    } catch (error) {
      setMessage({ severity: "error", text: error instanceof Error ? error.message : "Could not save autos." });
    } finally {
      setBusy(null);
    }
  };
  const updateCode = async () => {
    if (!api) return;
    if (hasErrors(issues)) {
      setMessage({ severity: "error", text: "Fix the problems marked in red before updating code." });
      return;
    }
    setBusy("update");
    try {
      const result = await api.updateAutoCode(document, generateAutosJava(document, project));
      applyFiles(result.state);
      setSavedJson(JSON.stringify(document));
      setMessage({ severity: "success", text: `Wrote GeneratedAutos.java${result.hookAdded ? " and registered it in RobotAutos.java" : ""}. Deploy robot code to use it.` });
    } catch (error) {
      setMessage({ severity: "error", text: error instanceof Error ? error.message : "Could not update auto code." });
    } finally {
      setBusy(null);
    }
  };

  const generated = useMemo(() => {
    if (view !== "code") return "";
    try { return generateAutosJava(document, project); }
    catch (error) { return `// ${error instanceof Error ? error.message : "Could not generate code."}\n// Fix the problems listed in the Auto Builder.`; }
  }, [view, document, project]);

  const autoIssues = auto ? issues.filter(issue => issue.autoId === auto.id) : [];
  const selectedStep = auto?.steps.find(step => step.id === selectedStepId) ?? null;
  const selectedIndex = auto && selectedStep ? auto.steps.indexOf(selectedStep) : -1;
  const selectedSegment = selectedStep ? replay.segments.find(segment => segment.stepId === selectedStep.id) : undefined;
  const legInfo: LegReplayInfo | undefined = selectedStep?.type === "drive" && selectedSegment ? {
    seconds: selectedSegment.end - selectedSegment.start,
    exitSpeed: frameAt(replay, selectedSegment.end)?.speed ?? 0,
    finished: !replay.unfinishedStepIds.includes(selectedStep.id)
  } : undefined;
  const legCount = auto?.steps.filter(step => step.type === "drive").length ?? 0;

  return (
    <div className="ab-root">
      {/* Autos in this robot project, with the actions that apply to all of them. */}
      <section className="ab-pane">
        <div className="ab-pane-header">
          <Typography sx={{ fontWeight: 600, flex: 1 }}>Autos</Typography>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={newAuto}>New</Button>
        </div>
        <div className="ab-pane-body" style={{ padding: 0 }}>
          {files.loading && <CircularProgress size={22} sx={{ display: "block", m: "16px auto" }} />}
          {!files.loading && document.autos.length === 0 && <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>
            No autos yet. Create one to start placing points.
          </Typography>}
          <ul className="ab-autos">
            {document.autos.map(candidate => {
              const count = issues.filter(issue => issue.autoId === candidate.id && issue.severity === "error").length;
              const seconds = allReplays.get(candidate.id) ?? 0;
              const mirrored = candidate.symmetry.flipX || candidate.symmetry.flipY;
              return <li key={candidate.id} className={`ab-auto${candidate.id === selectedAutoId ? " selected" : ""}`} onClick={() => selectAuto(candidate.id)}>
                <span className={`ab-alliance-dot ${candidate.alliance ?? ""}`} title={candidate.alliance ?? "Any alliance"} />
                <span style={{ minWidth: 0 }}>
                  <span className="ab-auto-name" style={{ display: "block" }}>{candidate.name || "(unnamed)"}</span>
                  <span className="ab-auto-meta">{candidate.steps.length} steps{seconds > 0 ? ` · ${seconds.toFixed(1)} s` : ""}{mirrored ? " · mirrored" : ""}</span>
                </span>
                <span>
                  {candidate.isDefault && <StarIcon fontSize="small" color="primary" titleAccess="Default auto" />}
                  {count > 0 && <Chip size="small" label={count} color="error" />}
                </span>
              </li>;
            })}
          </ul>
        </div>
        <Stack spacing={1} sx={{ p: 1.5, borderTop: "1px solid rgba(250, 204, 21, 0.12)" }}>
          {dirty && <Typography variant="caption" color="warning.main">Unsaved changes</Typography>}
          {errorCount > 0 && <Typography variant="caption" color="error">{errorCount} problem{errorCount === 1 ? "" : "s"} to fix before updating code</Typography>}
          {files.robotAutosHooked === false && <Typography variant="caption" color="text.secondary">Update code also registers generated autos in RobotAutos.java.</Typography>}
          <Button fullWidth variant="contained" startIcon={busy === "update" ? <CircularProgress size={16} /> : <CodeIcon />}
            disabled={!api || busy !== null || errorCount > 0} sx={{ whiteSpace: "nowrap" }} onClick={() => void updateCode()}>Update code</Button>
          <Stack direction="row" spacing={1}>
            <Button fullWidth size="small" variant="outlined" startIcon={busy === "save" ? <CircularProgress size={14} /> : <SaveIcon />}
              disabled={!api || busy !== null || !dirty} onClick={() => void save()}>Save</Button>
            <Tooltip title="Reload autos from the robot project">
              <IconButton size="small" aria-label="Reload autos" onClick={() => {
                if (!dirty || window.confirm("Discard unsaved auto changes and reload?")) void load();
              }}><RefreshIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </section>

      {/* The selected auto: its settings, the field or code, and the replay. */}
      <section className="ab-main">
        {files.error && <Alert severity={api ? "error" : "info"}>{files.error}</Alert>}
        {auto ? <div className="ab-toolbar">
          <TextField size="small" label="Auto name" value={auto.name} sx={{ flex: 1, minWidth: 160 }}
            error={autoIssues.some(issue => !issue.stepId && /name|None/.test(issue.message))}
            onChange={event => updateSelected(current => ({ ...current, name: event.target.value }))} />
          <Tooltip title="Which alliance's chooser shows this auto. Coordinates are never flipped automatically.">
            <ToggleButtonGroup size="small" exclusive value={auto.alliance ?? "Any"}
              onChange={(_, value) => value && updateSelected(current => ({ ...current, alliance: value === "Any" ? null : value }))}>
              <ToggleButton value="Any">Any</ToggleButton>
              <ToggleButton value="Blue" sx={{ "&.Mui-selected": { color: "#60a5fa" } }}>Blue</ToggleButton>
              <ToggleButton value="Red" sx={{ "&.Mui-selected": { color: "#f87171" } }}>Red</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
          <Tooltip title="Symmetry: also generate a mirrored copy for the other side. Flip across the center line (↔), top to bottom (↕), or both.">
            <ToggleButtonGroup size="small" value={[...(auto.symmetry.flipX ? ["x"] : []), ...(auto.symmetry.flipY ? ["y"] : [])]}
              onChange={(_, values: string[]) => {
                updateSelected(current => ({ ...current, symmetry: { flipX: values.includes("x"), flipY: values.includes("y") } }));
                if (!values.length) setShowMirror(false);
              }}>
              <ToggleButton value="x" aria-label="Mirror across the center line"><SwapHorizIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="y" aria-label="Mirror top to bottom"><SwapVertIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
          <Tooltip title={auto.isDefault ? "Default auto (selected when the robot starts)" : "Make this the default auto"}>
            <IconButton aria-label="Default auto" color={auto.isDefault ? "primary" : "default"} onClick={() => setDefault(!auto.isDefault)}>
              {auto.isDefault ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
          <IconButton aria-label="More auto actions" onClick={event => setAutoMenu(event.currentTarget)}><MoreVertIcon /></IconButton>
          <Menu anchorEl={autoMenu} open={autoMenu !== null} onClose={() => setAutoMenu(null)}>
            <MenuItem onClick={() => { duplicateAuto(); setAutoMenu(null); }}>
              <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon><ListItemText>Duplicate</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => flipInPlace({ flipX: true, flipY: false })}>
              <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon><ListItemText primary="Flip points across center line" secondary="Changes this auto" />
            </MenuItem>
            <MenuItem onClick={() => flipInPlace({ flipX: false, flipY: true })}>
              <ListItemIcon><SwapVertIcon fontSize="small" /></ListItemIcon><ListItemText primary="Flip points top to bottom" secondary="Changes this auto" />
            </MenuItem>
            <MenuItem onClick={() => updateSelected(current => ({ ...current, clearRequestsAtEnd: !current.clearRequestsAtEnd }))}>
              <ListItemIcon><Checkbox size="small" checked={auto.clearRequestsAtEnd} sx={{ p: 0 }} /></ListItemIcon>
              <ListItemText primary="Clear state requests at the end" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setAutoMenu(null); deleteAuto(); }} sx={{ color: "error.main" }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete auto</ListItemText>
            </MenuItem>
          </Menu>
        </div> : !files.error && <Typography color="text.secondary">Create or pick an auto on the left.</Typography>}

        <div className="ab-pane" style={{ flex: 1 }}>
          <div className="ab-pane-header" style={{ minHeight: 40, padding: "4px 8px" }}>
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, value) => value && setView(value)}>
              <ToggleButton value="field">Field</ToggleButton>
              <ToggleButton value="code">Code</ToggleButton>
            </ToggleButtonGroup>
            {mirror && view === "field" && <ToggleButtonGroup size="small" exclusive value={viewingMirror ? "mirror" : "original"}
              onChange={(_, value) => { if (value) { setShowMirror(value === "mirror"); stopReplay(); } }}>
              <ToggleButton value="original">{auto?.alliance ?? "Original"}</ToggleButton>
              <ToggleButton value="mirror">{mirror.alliance ? `${mirror.alliance} copy` : "Mirrored copy"}</ToggleButton>
            </ToggleButtonGroup>}
            <span className="ab-toolbar-spacer" />
            {view === "field" && <Tooltip title={livePose ? "Insert a drive point at the robot's live position" : "Connect to a robot to use its position"}>
              <span><Button size="small" startIcon={<MyLocationIcon />} disabled={!auto || !livePose} sx={{ whiteSpace: "nowrap" }}
                onClick={() => livePose && auto && fieldAddPoint(Math.round(livePose.x * 100) / 100, Math.round(livePose.y * 100) / 100)}>
                Point at robot
              </Button></span>
            </Tooltip>}
          </div>
          <div className="ab-stage">
            {view === "code"
              ? <pre className="ab-code" aria-label="Generated Java">{generated}</pre>
              : <AutoField auto={shownAuto} field={field} layout={layout} robot={files.robot} stateColor={stateColor} selectedStepId={selectedStepId} pose={fieldPose}
                onSelectStep={setSelectedStepId} onAddPoint={fieldAddPoint} onChangePoint={fieldChangePoint} onChangeSubpoint={changeSubpoint} />}
            {view === "field" && frame && <Chip className="ab-replay-pill" size="small" color="primary"
              label={`Replay · ${frame.speed.toFixed(1)} m/s${replayState ? ` · ${replayState}` : ""}`} />}
          </div>
          <Divider />
          <AutoReplayBar replay={replay} time={replayTime} playing={playing} speed={replaySpeed} stateColor={stateColor} activeStepId={activeStepId}
            onPlay={() => { if (replayTime === null || replayTime >= replay.duration) setReplayTime(0); setPlaying(true); }}
            onPause={() => setPlaying(false)} onStop={stopReplay}
            onSeek={time => { setPlaying(false); setReplayTime(time); }} onSpeed={setReplaySpeed} onSelectStep={setSelectedStepId} />
        </div>
      </section>

      {/* Steps in run order, and the selected step's settings. */}
      <section className="ab-pane">
        <div className="ab-pane-header">
          <Typography sx={{ fontWeight: 600, flex: 1 }}>Steps{auto ? ` (${auto.steps.length})` : ""}</Typography>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={!auto} onClick={event => setAddMenu(event.currentTarget)}>Add step</Button>
          <Menu anchorEl={addMenu} open={addMenu !== null} onClose={() => setAddMenu(null)}>
            {(Object.keys(stepLabels) as AutoStepType[]).map(type => <MenuItem key={type} onClick={() => { addStep(type); setAddMenu(null); }}>
              <ListItemIcon>{stepIcons[type]}</ListItemIcon>
              <ListItemText primary={stepLabels[type]} secondary={stepDescriptions[type]} />
            </MenuItem>)}
          </Menu>
        </div>
        {!auto ? <div className="ab-pane-body"><Typography color="text.secondary" variant="body2">Pick an auto to see its steps.</Typography></div> : <>
          <div className="ab-pane-body" style={{ flex: "0 1 auto", maxHeight: "45%" }}>
            {auto.steps.length === 0
              ? <Typography variant="body2" color="text.secondary">Click the field to add drive points, or use Add step.</Typography>
              : <StepList steps={auto.steps} selectedStepId={selectedStepId} activeStepId={activeStepId} durations={durations} issues={autoIssues}
                stateColor={stateColor} onSelect={setSelectedStepId} onMove={moveStep} onDelete={deleteStep} />}
          </div>
          <div className="ab-pane-body ab-inspector">
            {selectedStep
              ? <StepInspector key={selectedStep.id} step={selectedStep} states={files.states} mirrored={viewingMirror}
                driveNumber={auto.steps.slice(0, selectedIndex + 1).filter(step => step.type === "drive").length}
                issues={autoIssues.filter(issue => issue.stepId === selectedStep.id)} legInfo={legInfo}
                onChange={patch => updateStep(selectedStep.id, patch)} onApplyLimitsToAll={applyLimitsToAll} />
              : <AutoOverview auto={auto} legCount={legCount} duration={replay.duration}
                issues={autoIssues} onSelectStep={setSelectedStepId} />}
          </div>
        </>}
      </section>

      <Snackbar open={message !== null} autoHideDuration={message?.severity === "error" ? 9000 : 4000} onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        {message ? <Alert severity={message.severity} variant="filled" onClose={() => setMessage(null)}>{message.text}</Alert> : undefined}
      </Snackbar>
    </div>
  );
}

/** Shown when no step is selected: totals, problems and a short how-to. */
function AutoOverview({ auto, legCount, duration, issues, onSelectStep }: {
  auto: AutoRoutine;
  legCount: number;
  duration: number;
  issues: ReturnType<typeof validateAutos>;
  onSelectStep: (stepId: string) => void;
}) {
  return <Stack spacing={2}>
    <Stack direction="row" spacing={3}>
      <Stat label="Drive legs" value={String(legCount)} />
      <Stat label="Replay time" value={`${duration.toFixed(1)} s`} warn={duration > 15} />
    </Stack>
    {issues.length > 0 && <Stack spacing={1}>
      <Typography variant="overline" color="text.secondary">Problems</Typography>
      {issues.map(issue => <Alert key={`${issue.stepId ?? ""}${issue.message}`} severity={issue.severity} sx={{ py: 0, cursor: issue.stepId ? "pointer" : undefined }}
        onClick={() => issue.stepId && onSelectStep(issue.stepId)}>{issue.message}</Alert>)}
    </Stack>}
    <Stack spacing={0.5}>
      <Typography variant="overline" color="text.secondary">Editing</Typography>
      {[
        "Click the field to add a drive point after the selected step.",
        "Drag a point to move it; drag its ring to aim it (Shift snaps to 15°).",
        "Each drive step has its own speed, acceleration and finish tolerances.",
        "Press play to watch the ideal motion. Delete removes the selected step; Esc deselects."
      ].map(line => <Typography key={line} variant="body2" color="text.secondary">{line}</Typography>)}
    </Stack>
    {!auto.steps.length && <Typography variant="body2">Start by clicking where the robot begins the auto. The replay starts from point 1.</Typography>}
  </Stack>;
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <Stack>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h6" color={warn ? "error" : undefined}>{value}</Typography>
  </Stack>;
}

