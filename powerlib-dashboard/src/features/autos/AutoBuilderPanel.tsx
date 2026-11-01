import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import AddLocationIcon from "@mui/icons-material/AddLocationAlt";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import RedoIcon from "@mui/icons-material/Redo";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import UndoIcon from "@mui/icons-material/Undo";
import VideocamIcon from "@mui/icons-material/Videocam";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { driveModel, getPowerLibAutoChooser } from "../drive/driveModel";
import { useFieldLayout } from "../field/fieldLayouts";
import { AutoField } from "./AutoField";
import type { GhostRoute } from "./AutoField";
import { RunRecorder, readRuns, saveRuns } from "./autoActual";
import type { ActualRun } from "./autoActual";
import { AutoReplayBar } from "./AutoReplayBar";
import { ShortcutsDialog } from "./AutoShortcuts";
import { MultiStepInspector, StepInspector, StepList, stepDescriptions, stepIcons } from "./AutoSteps";
import type { BranchView, LegReplayInfo } from "./AutoSteps";
import {
  allSteps,
  createAuto,
  createId,
  createStep,
  deleteNamedPoint,
  emptyDocument,
  filterSteps,
  flipPoint,
  flipSteps,
  generateAutosJava,
  hasErrors,
  insertStepsAt,
  legConstraints,
  legEndHeading,
  locateStep,
  mapSteps,
  mirroredAuto,
  moveStepsInto,
  normalizeHeading,
  outermostSteps,
  parseAutoDocument,
  round,
  routeSteps,
  setNamedPoint,
  shiftSteps,
  stepLabels,
  syncNamedPoints,
  uniquePointName,
  validateAutos
} from "./autoModel";
import type { AutoDocument, AutoProject, AutoRoutine, AutoStep, AutoStepType, BranchArm, BranchChoices, BranchStep, DriveStep, InsertTarget, LegConstraints, ListRef, NamedPoint, Symmetry } from "./autoModel";
import { frameAt, loopPeriodSeconds, replayAuto, segmentAt, stateAt } from "./autoReplay";
import { describeLimits, drivetrainLimits, speedReport } from "./autoLimits";
import type { DrivetrainConstants } from "./autoLimits";
import { CameraDialog, cameraColor } from "./AutoCameras";
import { defaultVisionLimits, fixAt, routeVision } from "./autoVision";
import type { VisionLimits } from "./autoVision";
import { fieldOccluders } from "../field/fieldObstacles";
import { useAutoHistory } from "./useAutoHistory";
import { autoFieldSize, setPendingAutoSave } from "./autoCode";
import { ColumnSplitter, gridColumns, useColumnLayout } from "./AutoColumns";
import "./autos.css";
import "./autoBuilder.css";

type FilesState = {
  loading: boolean;
  path: string;
  states: string[];
  driveCommandInstalled: boolean | null;
  robotAutosHooked: boolean | null;
  robotAutosStrings: string[];
  checks: string[];
  robot: { width: number; length: number };
  /** From TunerConstants, for the speed checks; null when the robot project doesn't have it. */
  drivetrain: DrivetrainConstants | null;
  /** From VisionConstants, for the tag view; null when the robot project doesn't have it. */
  vision: { basePositionStdDev: number; maxTagDistance: number; cameraNames: string[] } | null;
  error: string | null;
};

type Message = { severity: "success" | "error" | "info" | "warning"; text: string };

const stateColors = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#2dd4bf", "#f87171", "#fde047"];

const isDrive = (step: AutoStep): step is DriveStep => step.type === "drive";
const lastDrive = (steps: AutoStep[]) => [...steps].reverse().find(isDrive);

/** The faint routes for the sides of branches the field isn't showing. */
function branchGhosts(route: AutoStep[], choices: BranchChoices): GhostRoute[] {
  return route.flatMap((step, index) => {
    if (step.type !== "branch") return [];
    const shown = choices[step.id] ?? "then";
    const other = step[shown === "then" ? "otherwise" : "then"];
    const from = lastDrive(route.slice(0, index)) ?? null;
    const to = route.slice(index + 1 + routeSteps(step[shown], choices).length).find(isDrive) ?? null;
    const points = routeSteps(other, choices).filter(isDrive).map(drive => ({ stepId: drive.id, x: drive.x, y: drive.y }));
    return points.length || (from && to) ? [{ from, points, to }] : [];
  });
}

export function AutoBuilderPanel() {
  const api = window.powerlib;
  const { status } = useNetworkTables();
  const topics = useTopics("drive");
  const [now, setNow] = useState(() => performance.now());
  const [files, setFiles] = useState<FilesState>({ loading: true, path: "", states: [], driveCommandInstalled: null,
    robotAutosHooked: null, robotAutosStrings: [], checks: [], robot: { width: 0.914, length: 0.914 }, drivetrain: null, vision: null, error: null });
  const { document, change, reset, undo, redo, canUndo, canRedo } = useAutoHistory();
  const [savedJson, setSavedJson] = useState(JSON.stringify(emptyDocument()));
  const [selectedAutoId, setSelectedAutoId] = useState<string | null>(null);
  /** Selected steps in click order; the last is the primary step the inspector shows. */
  const [selection, setSelection] = useState<string[]>([]);
  const selectedStepId = selection.length ? selection[selection.length - 1] : null;
  const setSelectedStepId = useCallback((id: string | null) => setSelection(id ? [id] : []), []);
  const selectSteps = useCallback((ids: string[], mode: "replace" | "toggle" | "add") => setSelection(current =>
    mode === "replace" ? ids
      : mode === "add" ? [...current.filter(id => !ids.includes(id)), ...ids]
        : ids.reduce((next, id) => next.includes(id) ? next.filter(other => other !== id) : [...next, id], current)), []);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [message, setMessage] = useState<Message | null>(null);
  const [view, setView] = useState<"field" | "code">("field");
  const [showMirror, setShowMirror] = useState(false);
  const [replayTime, setReplayTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  /** The add-step menu; `into` is set when it adds to one side of a branch. */
  const [addMenu, setAddMenu] = useState<{ anchor: HTMLElement; into?: { branchId: string; arm: BranchArm } } | null>(null);
  /** The side of each branch the field and replay follow. */
  const [choices, setChoices] = useState<BranchChoices>({});
  const showArm = useCallback((branchId: string, arm: BranchArm) =>
    setChoices(current => (current[branchId] ?? "then") === arm ? current : { ...current, [branchId]: arm }), []);
  /** Right-click menu for an auto in the list, at the pointer. */
  const [autoMenu, setAutoMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /** The tag view: camera coverage on the field and AprilTag coverage under the timeline. */
  const [showTags, setShowTags] = useState(false);
  const [camerasOpen, setCamerasOpen] = useState(false);
  const clipboard = useRef<AutoStep[]>([]);
  const layout = useFieldLayout();
  const [columns, setColumns] = useColumnLayout();
  const field = useMemo(() => layout ? { length: layout.length, width: layout.width } : autoFieldSize(), [layout]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  const livePose = driveModel(topics, status === "connected", now).pose;

  // Each enabled autonomous period is recorded, so the route the robot really took can be drawn over the plan.
  const recorder = useRef(new RunRecorder());
  const [runs, setRuns] = useState<Record<string, ActualRun>>(readRuns);
  const [recording, setRecording] = useState<ActualRun | null>(null);
  const [showActual, setShowActual] = useState(true);
  useEffect(() => {
    const connected = status === "connected";
    const model = driveModel(topics, connected, performance.now());
    const { run, ended } = recorder.current.update({ time: Date.now(), mode: connected ? model.text("mode") : undefined,
      enabled: model.boolean("enabled"), autoName: getPowerLibAutoChooser(topics)?.active, pose: model.pose });
    setRecording(ended ? null : run);
    if (ended && run && run.points.length > 1) {
      setRuns(current => { const next = { ...current, [run.autoName]: run }; saveRuns(next); return next; });
      setShowActual(true);
    }
  }, [topics, status]);
  const clearRun = (name: string) => setRuns(current => {
    const next = { ...current };
    delete next[name];
    saveRuns(next);
    return next;
  });

  const project: AutoProject = useMemo(() => ({ states: files.states, driveCommandInstalled: files.driveCommandInstalled, field,
    handWrittenNames: files.robotAutosStrings, checks: files.checks }), [files.states, files.driveCommandInstalled, files.robotAutosStrings, files.checks, field]);
  const issues = useMemo(() => validateAutos(document, project), [document, project]);
  const dirty = JSON.stringify(document) !== savedJson;
  const errorCount = issues.filter(issue => issue.severity === "error").length;
  const auto = document.autos.find(candidate => candidate.id === selectedAutoId) ?? null;
  const mirror = useMemo(() => auto ? mirroredAuto(auto, field) : null, [auto, field]);
  const viewingMirror = showMirror && mirror !== null;
  const shownAuto = viewingMirror ? mirror : auto;
  // The field draws one run: each branch followed by the side picked for it.
  const routeAuto = useMemo(() => shownAuto ? { ...shownAuto, steps: routeSteps(shownAuto.steps, choices) } : null, [shownAuto, choices]);
  const ghosts = useMemo(() => routeAuto ? branchGhosts(routeAuto.steps, choices) : [], [routeAuto, choices]);
  const stepNumbers = useMemo(() => new Map(allSteps(auto?.steps ?? []).map((step, index) => [step.id, index + 1])), [auto]);
  const driveNumbers = useMemo(() => new Map(allSteps(auto?.steps ?? []).filter(isDrive).map((step, index) => [step.id, index + 1])), [auto]);
  const replay = useMemo(() => replayAuto(shownAuto ?? createAuto(""), choices), [shownAuto, choices]);
  const allReplays = useMemo(() => new Map(document.autos.map(candidate => [candidate.id, replayAuto(candidate).duration])), [document.autos]);
  // Speed checks: the same auto driven the way the robot's drivetrain can.
  const drivetrain = useMemo(() => files.drivetrain ? drivetrainLimits(files.drivetrain) : null, [files.drivetrain]);
  const speed = useMemo(() => drivetrain && shownAuto ? speedReport(shownAuto, choices, replay, drivetrain) : null, [drivetrain, shownAuto, choices, replay]);
  // Tag view: which AprilTags the cameras can use along the route, and how well the robot could place itself.
  const visionLimits: VisionLimits = useMemo(() => ({ ...defaultVisionLimits,
    ...(files.vision ? { basePositionStdDev: files.vision.basePositionStdDev, maxTagDistance: files.vision.maxTagDistance } : {}) }), [files.vision]);
  const occluders = useMemo(() => layout?.drawing ? fieldOccluders(layout.drawing) : [], [layout]);
  const vision = useMemo(() => showTags && layout && document.cameras.some(camera => camera.enabled)
    ? routeVision(replay, document.cameras, layout.tags, occluders, visionLimits) : null,
  [showTags, layout, document.cameras, replay, occluders, visionLimits]);
  const stateColor = useCallback((state: string | null) => {
    const index = state === null ? -1 : files.states.indexOf(state);
    return index < 0 ? "#94a3b8" : stateColors[index % stateColors.length];
  }, [files.states]);

  // Replay drives the field robot; the live robot is shown otherwise.
  const frame = replayTime === null ? undefined : frameAt(replay, replayTime);
  // The replay robot's wheels follow its direction of travel, taken from the next frame.
  const nextFrame = replayTime === null ? undefined : frameAt(replay, replayTime + loopPeriodSeconds);
  const travel = frame && nextFrame && Math.hypot(nextFrame.x - frame.x, nextFrame.y - frame.y) > 1e-6
    ? Math.atan2(nextFrame.y - frame.y, nextFrame.x - frame.x) * 180 / Math.PI : undefined;
  const fieldPose = frame ? { x: frame.x, y: frame.y, heading: frame.heading, travel } : livePose;
  const activeSegment = replayTime === null ? undefined : segmentAt(replay, replayTime);
  const activeStepId = activeSegment && activeSegment.stepId !== "clear" ? activeSegment.stepId : null;
  const replayState = replayTime === null ? null : stateAt(replay, replayTime);
  const durations = useMemo(() => new Map(replay.segments.map(segment => [segment.stepId, segment.end - segment.start])), [replay]);
  // The cameras at the pose on the field: while replaying that is the playhead, otherwise the start.
  const visionOverlay = useMemo(() => {
    const sample = vision && fixAt(vision, replayTime ?? 0);
    // With the replay stopped and no robot connected, the cameras sit where the replay starts.
    const start = routeAuto?.steps.find(isDrive);
    const atPose = frame ? { x: frame.x, y: frame.y, heading: frame.heading }
      : livePose ?? (start ? { x: start.x, y: start.y, heading: legEndHeading(start) } : null);
    if (!sample || !atPose) return undefined;
    const enabled = document.cameras.filter(camera => camera.enabled);
    return {
      cones: enabled.map(camera => {
        const heading = atPose.heading * Math.PI / 180;
        return { id: camera.id, name: camera.name, color: cameraColor(document.cameras, camera.id),
          x: atPose.x + camera.x * Math.cos(heading) - camera.y * Math.sin(heading),
          y: atPose.y + camera.x * Math.sin(heading) + camera.y * Math.cos(heading),
          yaw: atPose.heading + camera.yaw, hFov: camera.hFov, range: visionLimits.maxTagDistance };
      }),
      lines: sample.fix.sightings.map(sighting => ({
        key: `${sighting.cameraId}-${sighting.tagId}`,
        color: cameraColor(document.cameras, sighting.cameraId),
        from: sighting.from, to: sighting.to,
        title: `${document.cameras.find(camera => camera.id === sighting.cameraId)?.name ?? "Camera"} sees tag ${sighting.tagId}: `
          + `${sighting.distance.toFixed(2)} m away, ${sighting.incidence.toFixed(0)}° off square, ${sighting.pixels.toFixed(0)} px across`
      }))
    };
  }, [vision, replayTime, frame, livePose, routeAuto, document.cameras, visionLimits.maxTagDistance]);

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
      // At the end the replay stops on its own and the field returns to editing.
      if (finished) { setPlaying(false); setReplayTime(null); }
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
  const startReplay = () => { if (replayTime === null || replayTime >= replay.duration) setReplayTime(0); setPlaying(true); };

  const applyFiles = (state: Awaited<ReturnType<NonNullable<typeof api>["readAutos"]>>) => {
    setFiles({ loading: false, path: state.path, states: state.states, driveCommandInstalled: state.driveCommandInstalled,
      robotAutosHooked: state.robotAutosHooked, robotAutosStrings: state.robotAutosStrings ?? [], checks: state.checks ?? [], robot: state.robot, drivetrain: state.drivetrain ?? null, vision: state.vision ?? null, error: state.error ?? null });
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
      reset(next);
      setSavedJson(JSON.stringify(next));
      setSelectedAutoId(current => next.autos.some(candidate => candidate.id === current) ? current : next.autos[0]?.id ?? null);
      setSelectedStepId(null);
    } catch (error) {
      setFiles(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Could not read autos." }));
    }
  }, [api, reset]);
  useEffect(() => { void load(); }, [load]);

  // Undo and redo can remove the selected auto or step; fall back to something that exists.
  useEffect(() => {
    if (selectedAutoId !== null && !document.autos.some(candidate => candidate.id === selectedAutoId)) {
      setSelectedAutoId(document.autos[0]?.id ?? null);
      setSelectedStepId(null);
    } else if (selection.some(id => !auto || !locateStep(auto.steps, id))) {
      setSelection(current => current.filter(id => auto && locateStep(auto.steps, id)));
    }
  }, [document, selectedAutoId, selection, auto, setSelectedStepId]);

  // A step picked on the side of a branch the field isn't showing switches the field to that side.
  useEffect(() => {
    const list = auto && selectedStepId ? locateStep(auto.steps, selectedStepId)?.list : null;
    if (list) showArm(list.branchId, list.arm);
  }, [auto, selectedStepId, showArm]);

  // `key` merges rapid edits of the same thing (a drag, typing in one field) into one undo step.
  const updateAuto = (id: string, update: (auto: AutoRoutine) => AutoRoutine, key?: string) => {
    change(current => syncNamedPoints({ ...current, autos: current.autos.map(candidate => candidate.id === id ? update(candidate) : candidate) }, id), key);
  };
  const updateSelected = (update: (auto: AutoRoutine) => AutoRoutine, key?: string) => { if (auto) updateAuto(auto.id, update, key); };
  const updateStep = (stepId: string, patch: Partial<AutoStep>, key = `step:${stepId}:${Object.keys(patch).sort().join(",")}`) => {
    updateSelected(current => ({ ...current, steps: mapSteps(current.steps, step => step.id === stepId ? { ...step, ...patch } as AutoStep : step) }), key);
  };

  /** New steps go after the selected step (the last one, in run order) so an auto is built in order. */
  const defaultTarget = (): InsertTarget => ({ after: [...allSteps(auto?.steps ?? [])].reverse().find(step => selection.includes(step.id))?.id ?? null });
  const insertSteps = (added: AutoStep[], target = defaultTarget()) => {
    if (!added.length) return;
    updateSelected(current => ({ ...current, steps: insertStepsAt(current.steps, target, added) }));
    setSelection(added.map(step => step.id));
  };
  const insertStep = (step: AutoStep, target?: InsertTarget) => insertSteps([step], target);
  /** The drive just before where new steps go, along the route they'll be on. */
  const driveBefore = (target: InsertTarget) => {
    if (!auto) return undefined;
    const preview = "into" in target ? { ...choices, [target.into.branchId]: target.into.arm } : choices;
    const route = routeSteps(auto.steps, preview);
    const anchor = "into" in target ? target.into.branchId : target.after;
    const at = anchor === null ? -1 : route.findIndex(step => step.id === anchor);
    if (at < 0) return lastDrive(route);
    // After a branch (or at the end of one of its sides), the robot comes from the end of the side it took.
    const anchored = route[at];
    const end = anchored.type === "branch" ? at + 1 + routeSteps(anchored[preview[anchored.id] ?? "then"], preview).length : at + 1;
    return lastDrive(route.slice(0, end));
  };
  /** A new leg starts from the previous leg's pose and limits, so long autos need few edits. */
  const newDriveStep = (target: InsertTarget, x?: number, y?: number): DriveStep => {
    const previous = driveBefore(target);
    const base = createStep("drive", project) as DriveStep;
    return { ...base, ...(previous ? { x: previous.x, y: previous.y, heading: previous.heading, ...legConstraints(previous) } : {}),
      ...(x !== undefined && y !== undefined ? { x, y } : {}) };
  };
  const addStep = (type: AutoStepType, target = defaultTarget()) =>
    insertStep(type === "drive" ? newDriveStep(target) : createStep(type, project), target);
  /** A drive step to a named point, linked so it follows the point. */
  const addFromPoint = (pointId: string) => {
    const point = document.points.find(candidate => candidate.id === pointId);
    if (point && auto) insertStep({ ...newDriveStep(defaultTarget(), point.x, point.y), heading: point.heading, pointId: point.id });
  };
  const linkPoint = (stepId: string, pointId: string | null) => {
    const point = pointId === null ? undefined : document.points.find(candidate => candidate.id === pointId);
    updateStep(stepId, point ? { x: point.x, y: point.y, heading: point.heading, pointId: point.id } : { pointId: null });
  };
  const savePoint = (step: DriveStep) => {
    const point: NamedPoint = { id: createId(), name: uniquePointName(document), x: step.x, y: step.y, heading: step.heading };
    change(current => setNamedPoint({ ...current, autos: current.autos.map(candidate => ({ ...candidate,
      steps: mapSteps(candidate.steps, other => other.id === step.id ? { ...other, pointId: point.id } as AutoStep : other) })) }, point));
  };
  const renamePoint = (pointId: string, name: string) => {
    change(current => ({ ...current, points: current.points.map(point => point.id === pointId ? { ...point, name } : point) }), `point-name:${pointId}`);
  };
  const deletePoint = (point: NamedPoint) => {
    change(current => deleteNamedPoint(current, point.id));
    setMessage({ severity: "info", text: `Deleted "${point.name}". Steps that used it keep their spot. Press Ctrl+Z to undo.` });
  };

  // In the mirrored view, field edits are flipped back onto the original auto.
  const fieldAddPoint = (x: number, y: number) => {
    if (!auto) return;
    const point = viewingMirror ? flipPoint({ x, y, heading: 0 }, auto.symmetry, field) : { x, y };
    insertStep(newDriveStep(defaultTarget(), point.x, point.y));
  };
  const fieldChangePoint = (stepId: string, patch: Partial<Pick<DriveStep, "x" | "y" | "heading">>, key = `point:${stepId}:${Object.keys(patch).sort().join(",")}`) => {
    if (!viewingMirror || !auto || !mirror) { updateStep(stepId, patch, key); return; }
    const shown = allSteps(mirror.steps).find((step): step is DriveStep => step.id === stepId && step.type === "drive");
    if (!shown) return;
    const original = flipPoint({ ...shown, ...patch }, auto.symmetry, field);
    updateStep(stepId, { x: original.x, y: original.y, heading: original.heading }, key);
  };
  /** Moves the point a leg faces; in the mirrored view it is flipped back onto the original auto. */
  const changeFace = (stepId: string, x: number, y: number, pointId: string | null) => {
    const point = viewingMirror && auto ? flipPoint({ x, y, heading: 0 }, auto.symmetry, field) : { x, y };
    updateStep(stepId, { turn: { mode: "face", x: point.x, y: point.y, pointId } }, `face:${stepId}`);
  };
  // Subpoint progress is a fraction of the leg, so it is the same in the mirrored view.
  const changeSubpoint = (stepId: string, subpointId: string, progress: number) => {
    updateSelected(current => ({ ...current, steps: mapSteps(current.steps, step => step.id === stepId && step.type === "drive"
      ? { ...step, subpoints: step.subpoints.map(subpoint => subpoint.id === subpointId ? { ...subpoint, progress } : subpoint) }
      : step) }), `subpoint:${subpointId}`);
  };
  /** Applies field edits to several drive points at once, flipping them back in the mirrored view. */
  const changePoints = (changes: { stepId: string; x?: number; y?: number; heading?: number }[], key: string) => {
    if (!auto || !shownAuto) return;
    const patches = new Map(changes.map(change => {
      const shown = allSteps(shownAuto.steps).find((step): step is DriveStep => step.id === change.stepId && step.type === "drive");
      if (!shown) return [change.stepId, null] as const;
      const next = { x: change.x ?? shown.x, y: change.y ?? shown.y, heading: change.heading ?? shown.heading };
      return [change.stepId, viewingMirror ? flipPoint(next, auto.symmetry, field) : next] as const;
    }));
    updateSelected(current => ({ ...current, steps: mapSteps(current.steps, step => {
      const patch = patches.get(step.id);
      return patch && step.type === "drive" ? { ...step, x: patch.x, y: patch.y, heading: patch.heading } : step;
    }) }), key);
  };
  const movePoints = (moves: { stepId: string; x: number; y: number }[]) => changePoints(moves, `move:${moves.map(move => move.stepId).join(",")}`);
  /** Moves or turns the selected drive points in the frame shown on the field. */
  const nudgeSelected = (dx: number, dy: number, turn: number) => {
    const shown = allSteps(shownAuto?.steps ?? []).filter((step): step is DriveStep => step.type === "drive" && selection.includes(step.id));
    if (!shown.length) return;
    const clamp = (value: number, max: number) => round(Math.min(Math.max(value, 0), max));
    changePoints(shown.map(step => turn !== 0
      ? { stepId: step.id, heading: normalizeHeading(Math.round(step.heading + turn)) }
      : { stepId: step.id, x: clamp(step.x + dx, field.length), y: clamp(step.y + dy, field.width) }),
    `nudge:${shown.map(step => step.id).join(",")}:${turn !== 0 ? "turn" : "move"}`);
  };
  /** A copy with new ids, so pasted and duplicated steps never share subpoints or branch sides with the original. */
  const cloneStep = (step: AutoStep): AutoStep => step.type === "drive"
    ? { ...step, id: createId(), subpoints: step.subpoints.map(subpoint => ({ ...subpoint, id: createId() })) }
    : step.type === "branch" ? { ...step, id: createId(), then: step.then.map(cloneStep), otherwise: step.otherwise.map(cloneStep) }
      : { ...step, id: createId() };

  /** Moves the steps one place earlier or later in their list together, keeping their order; blocked at the ends. */
  const moveSteps = (stepIds: string[], offset: -1 | 1) => {
    updateSelected(current => {
      const steps = shiftSteps(current.steps, stepIds, offset);
      return steps === current.steps ? current : { ...current, steps };
    });
  };
  /** Drops the steps (kept in their order) before the step now at `index` of `list`. */
  const moveStepsTo = (stepIds: string[], list: ListRef, index: number) => {
    updateSelected(current => {
      const steps = moveStepsInto(current.steps, stepIds, list, index);
      return steps === current.steps ? current : { ...current, steps };
    });
  };
  const deleteSteps = (stepIds: string[]) => {
    updateSelected(current => ({ ...current, steps: filterSteps(current.steps, step => !stepIds.includes(step.id)) }));
    setSelection(current => current.filter(id => !stepIds.includes(id)));
  };
  const deleteStep = (stepId: string) => deleteSteps([stepId]);
  const applyLimits = (stepIds: string[] | null, limits: Partial<LegConstraints>) => {
    updateSelected(current => ({ ...current, steps: mapSteps(current.steps, step =>
      step.type === "drive" && (stepIds === null || stepIds.includes(step.id)) ? { ...step, ...limits } : step) }),
    `limits:${stepIds?.join(",") ?? "all"}:${Object.keys(limits).join(",")}`);
  };
  const applyLimitsToAll = (limits: LegConstraints) => {
    applyLimits(null, limits);
    setMessage({ severity: "success", text: "Applied these limits to every drive step in this auto." });
  };
  /** Lines up the selected drive points with the primary (last selected) one. */
  const alignSelected = (axis: "x" | "y") => {
    const drives = allSteps(auto?.steps ?? []).filter(isDrive);
    const primary = drives.find(step => step.id === selectedStepId) ?? [...drives].reverse().find(step => selection.includes(step.id));
    if (!primary) return;
    updateSelected(current => ({ ...current, steps: mapSteps(current.steps, step =>
      step.type === "drive" && selection.includes(step.id) ? { ...step, [axis]: primary[axis] } : step) }));
  };
  const stepsInOrder = (stepIds: string[]) => allSteps(auto?.steps ?? []).filter(step => stepIds.includes(step.id));
  /** The selected steps to copy or duplicate; a selected branch carries the steps inside it. */
  const stepsToCopy = (stepIds: string[]) => outermostSteps(auto?.steps ?? [], stepIds);

  // Building shortcuts; AutoShortcuts.tsx lists them for the help dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const typing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      const control = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      // Open menus and dialogs own the keyboard.
      if (shortcutsOpen || autoMenu || addMenu || target?.closest("[role='menu'], [role='listbox'], [role='dialog']")) return;
      const handled = () => { event.preventDefault(); event.stopPropagation(); };

      if (control && key === "s") { handled(); void save(); return; }
      // Inside a text field, undo and redo edit the text instead.
      if (typing) return;
      if (control && key === "z" && !event.shiftKey) { handled(); undo(); return; }
      if (control && (key === "y" || (key === "z" && event.shiftKey))) { handled(); redo(); return; }
      if (event.key === "?") { handled(); setShortcutsOpen(true); return; }
      if (event.key === " " && !control) { handled(); if (playing) setPlaying(false); else if (replay.frames.length) startReplay(); return; }
      if (!auto || event.altKey && !["arrowup", "arrowdown"].includes(key)) return;

      const ordered = allSteps(auto.steps);
      const index = ordered.findIndex(step => step.id === selectedStepId);
      const selectedSteps = stepsInOrder(selection);
      const anyDrive = selectedSteps.some(step => step.type === "drive");
      if (control && key === "a") {
        handled();
        setSelection(ordered.map(step => step.id));
      } else if (!control && !event.altKey && ["1", "2", "3", "4", "5"].includes(event.key)) {
        handled();
        addStep((["drive", "requestState", "waitForState", "wait", "branch"] as const)[Number(event.key) - 1]);
      } else if (!control && (event.key === "[" || event.key === "]") && ordered.length) {
        handled();
        const next = index < 0 ? (event.key === "]" ? 0 : ordered.length - 1)
          : Math.min(ordered.length - 1, Math.max(0, index + (event.key === "]" ? 1 : -1)));
        setSelectedStepId(ordered[next].id);
      } else if (control && key === "v" && clipboard.current.length) {
        handled();
        insertSteps(clipboard.current.map(cloneStep));
      } else if (!selectedSteps.length) {
        return;
      } else if (control && key === "c") {
        handled();
        clipboard.current = stepsToCopy(selection);
        setMessage({ severity: "info", text: `Copied ${selectedSteps.length === 1 ? "the step" : `${selectedSteps.length} steps`}. Press Ctrl+V to paste after the selected step.` });
      } else if (control && key === "d") {
        handled();
        insertSteps(stepsToCopy(selection).map(cloneStep));
      } else if (event.key === "Delete" || event.key === "Backspace") {
        handled();
        deleteSteps(selection);
      } else if (event.key === "Escape") {
        handled();
        setSelection([]);
      } else if (event.altKey && (key === "arrowup" || key === "arrowdown")) {
        handled();
        moveSteps(selection, key === "arrowup" ? -1 : 1);
      } else if (!control && key.startsWith("arrow") && anyDrive) {
        handled();
        const distance = event.shiftKey ? 0.25 : 0.05;
        nudgeSelected(key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0,
          key === "arrowdown" ? -distance : key === "arrowup" ? distance : 0, 0);
      } else if (!control && (key === "q" || key === "e") && anyDrive) {
        handled();
        nudgeSelected(0, 0, (event.shiftKey ? 1 : 15) * (key === "q" ? 1 : -1));
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
    change(current => ({ ...current, autos: [...current.autos, next] }));
    selectAuto(next.id);
  };
  // These take an auto id so the list's right-click menu can act on any auto.
  const duplicateAuto = (id: string) => {
    const source = document.autos.find(candidate => candidate.id === id);
    if (!source) return;
    const copy: AutoRoutine = { ...source, id: createId(), name: `${source.name} copy`, isDefault: false, steps: source.steps.map(cloneStep) };
    // The copy's branches have new ids; show the same sides as the original.
    const sides = allSteps(source.steps).filter((step): step is BranchStep => step.type === "branch");
    allSteps(copy.steps).filter((step): step is BranchStep => step.type === "branch").forEach((step, index) => showArm(step.id, choices[sides[index].id] ?? "then"));
    change(current => {
      const autos = [...current.autos];
      autos.splice(autos.findIndex(candidate => candidate.id === id) + 1, 0, copy);
      return { ...current, autos };
    });
    selectAuto(copy.id);
  };
  const deleteAuto = (id: string) => {
    const source = document.autos.find(candidate => candidate.id === id);
    if (!source) return;
    const remaining = document.autos.filter(candidate => candidate.id !== id);
    change(current => ({ ...current, autos: current.autos.filter(candidate => candidate.id !== id) }));
    if (id === selectedAutoId) selectAuto(remaining[0]?.id ?? null);
    setMessage({ severity: "info", text: `Deleted "${source.name || "(unnamed)"}". Press Ctrl+Z to undo.` });
  };
  const setDefault = (id: string, checked: boolean) => {
    change(current => ({ ...current, autos: current.autos.map(candidate => ({ ...candidate,
      isDefault: candidate.id === id ? checked : checked ? false : candidate.isDefault })) }));
  };
  const flipInPlace = (id: string, flips: Symmetry) => {
    updateAuto(id, current => ({ ...current, steps: flipSteps(current.steps, flips, field) }));
  };

  // Edits save on their own after a short pause; File → Update Code writes them into robot code.
  const persist = useCallback(async (next: AutoDocument) => {
    if (!api) return;
    setSaveState("saving");
    try {
      await api.saveAutos(next);
      setSavedJson(JSON.stringify(next));
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setMessage({ severity: "error", text: error instanceof Error ? error.message : "Could not save autos." });
    }
  }, [api]);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (!api || !dirty || files.loading) { flushRef.current = null; setPendingAutoSave(null); return; }
    const timer = window.setTimeout(() => { flushRef.current = null; setPendingAutoSave(null); void persist(document); }, 500);
    const flush = () => { window.clearTimeout(timer); flushRef.current = null; setPendingAutoSave(null); return persist(document); };
    flushRef.current = flush;
    setPendingAutoSave(flush);
    return () => window.clearTimeout(timer);
  }, [api, dirty, document, files.loading, persist]);
  // Leaving the tab saves anything still waiting.
  useEffect(() => () => { void flushRef.current?.(); }, []);
  const save = async () => { await flushRef.current?.(); };
  // File → Update Code may register the autos in RobotAutos.java; refresh what the panel shows.
  useEffect(() => {
    const onWritten = () => { void api?.readAutos().then(applyFiles).catch(() => {}); };
    window.addEventListener("powerlib:autos-written", onWritten);
    return () => window.removeEventListener("powerlib:autos-written", onWritten);
  });

  const generated = useMemo(() => {
    if (view !== "code") return "";
    try { return generateAutosJava(document, project); }
    catch (error) { return `// ${error instanceof Error ? error.message : "Could not generate code."}\n// Fix the problems listed in the Auto Builder.`; }
  }, [view, document, project]);

  // Speed warnings come from the auto on the field, which may be the mirrored copy; its steps keep their ids.
  const autoIssues = auto ? [...issues.filter(issue => issue.autoId === auto.id), ...(speed?.issues ?? []).map(issue => ({ ...issue, autoId: auto.id }))] : [];
  const selectedStep = allSteps(auto?.steps ?? []).find(step => step.id === selectedStepId) ?? null;
  const selectedSegment = selectedStep ? replay.segments.find(segment => segment.stepId === selectedStep.id) : undefined;
  const legInfo: LegReplayInfo | undefined = selectedStep?.type === "drive" && selectedSegment ? {
    seconds: selectedSegment.end - selectedSegment.start,
    exitSpeed: frameAt(replay, selectedSegment.end)?.speed ?? 0,
    peakSpeed: Math.max(0, ...replay.frames.filter(frame => frame.t > selectedSegment.start && frame.t <= selectedSegment.end).map(frame => frame.speed)),
    robotExtraSeconds: speed?.extraByStep.get(selectedStep.id),
    finished: !replay.unfinishedStepIds.includes(selectedStep.id)
  } : undefined;
  const branchView: BranchView = {
    checks: files.checks, reachedAt: selectedSegment?.start, period: document.periodSeconds,
    showing: selectedStep ? choices[selectedStep.id] ?? "then" : "then",
    onShow: arm => selectedStep && showArm(selectedStep.id, arm),
    onAddTo: (arm, anchor) => selectedStep && setAddMenu({ anchor, into: { branchId: selectedStep.id, arm } })
  };
  const addInto = addMenu?.into;
  // The run being recorded, or the last recorded one, for the auto on the field.
  const shownRun = shownAuto ? (recording?.autoName === shownAuto.name ? recording : runs[shownAuto.name]) : undefined;
  // Problems with the auto itself (not a step), shown beside its name.
  const autoLevelIssues = autoIssues.filter(issue => !issue.stepId);

  return (
    <div className="ab-root" style={{ gridTemplateColumns: gridColumns(columns) }}>
      {/* Autos in this robot project, with the actions that apply to all of them. */}
      <section className={`ab-pane${columns.leftOpen ? "" : " collapsed"}`}>
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
              return <li key={candidate.id} className={`ab-auto${candidate.id === selectedAutoId ? " selected" : ""}`} onClick={() => selectAuto(candidate.id)}
                title="Right-click to duplicate, flip or delete"
                onContextMenu={event => {
                  event.preventDefault();
                  if (candidate.id !== selectedAutoId) selectAuto(candidate.id);
                  setAutoMenu({ id: candidate.id, x: event.clientX, y: event.clientY });
                }}>
                <span className={`ab-alliance-dot ${candidate.alliance ?? ""}`} title={candidate.alliance ?? "Any alliance"} />
                <span style={{ minWidth: 0 }}>
                  <span className="ab-auto-name" style={{ display: "block" }}>{candidate.name || "(unnamed)"}</span>
                  <span className="ab-auto-meta">{allSteps(candidate.steps).length} steps{seconds > 0 ? ` · ${seconds.toFixed(1)} s` : ""}{mirrored ? " · mirrored" : ""}</span>
                </span>
                <span>
                  {candidate.isDefault && <StarIcon fontSize="small" color="primary" titleAccess="Default auto" />}
                  {count > 0 && <Chip size="small" label={count} color="error" />}
                </span>
              </li>;
            })}
          </ul>
          <AutoContextMenu menu={autoMenu} auto={document.autos.find(candidate => candidate.id === autoMenu?.id) ?? null} onClose={() => setAutoMenu(null)}
            onDuplicate={duplicateAuto} onFlip={flipInPlace} onDelete={deleteAuto} onDefault={setDefault}
            onToggleClear={id => updateAuto(id, current => ({ ...current, clearRequestsAtEnd: !current.clearRequestsAtEnd }))} />
          {!files.loading && <PointList points={document.points} autos={document.autos} canAdd={auto !== null && !viewingMirror}
            onAdd={addFromPoint} onRename={renamePoint} onDelete={deletePoint} />}
        </div>
        <Stack spacing={0.5} sx={{ p: 1, borderTop: "1px solid rgba(250, 204, 21, 0.12)" }}>
          {errorCount > 0 && <Typography variant="caption" color="error">{errorCount} problem{errorCount === 1 ? "" : "s"} to fix</Typography>}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Tooltip title={api ? "Autos save as you edit. File → Update Code writes them into robot code." : "Open in Power Tool to save autos"}>
              <Typography variant="caption" sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.5 }}
                color={saveState === "error" ? "error" : "text.secondary"}>
                {saveState === "error" ? "Not saved" : dirty || saveState === "saving" ? "Saving…" : <><CloudDoneIcon sx={{ fontSize: 14 }} />Saved</>}
              </Typography>
            </Tooltip>
            <Tooltip title="Undo (Ctrl+Z)">
              <span><IconButton size="small" aria-label="Undo" disabled={!canUndo} onClick={undo}><UndoIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Redo (Ctrl+Y)">
              <span><IconButton size="small" aria-label="Redo" disabled={!canRedo} onClick={redo}><RedoIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Reload autos from the robot project">
              <IconButton size="small" aria-label="Reload autos" onClick={() => {
                if (!dirty || window.confirm("Discard unsaved auto changes and reload?")) void load();
              }}><RefreshIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </section>

      <ColumnSplitter side="left" layout={columns} onChange={setColumns} />

      {/* The selected auto: its settings, the field or code, and the replay. */}
      <section className="ab-main">
        {files.error && <Alert severity={api ? "error" : "info"}>{files.error}</Alert>}
        {auto ? <div className="ab-toolbar">
          <TextField size="small" label="Auto name" value={auto.name} sx={{ flex: 1, minWidth: 160 }}
            error={autoIssues.some(issue => !issue.stepId && /name|None/.test(issue.message))}
            onChange={event => updateSelected(current => ({ ...current, name: event.target.value }), `name:${auto.id}`)} />
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
          {autoLevelIssues.length > 0 && <Tooltip title={<>{autoLevelIssues.map(issue => <div key={issue.message}>{issue.message}</div>)}</>}>
            <ErrorOutlineIcon color={hasErrors(autoLevelIssues) ? "error" : "warning"} aria-label="Problems with this auto" />
          </Tooltip>}
          <Tooltip title={auto.isDefault ? "Default auto (selected when the robot starts)" : "Make this the default auto"}>
            <IconButton aria-label="Default auto" color={auto.isDefault ? "primary" : "default"} onClick={() => setDefault(auto.id, !auto.isDefault)}>
              {auto.isDefault ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
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
            {view === "field" && shownRun && (shownRun === recording
              ? <Chip size="small" color="error" variant="outlined" label={`Recording · ${shownRun.seconds.toFixed(1)} s`} />
              : <Tooltip title={`The white line is where the robot went when it ran this auto at ${new Date(shownRun.recordedAt).toLocaleTimeString()}. Click to ${showActual ? "hide" : "show"} it.`}>
                <Chip size="small" label={`Last run · ${shownRun.seconds.toFixed(1)} s`} variant={showActual ? "filled" : "outlined"}
                  onClick={() => setShowActual(current => !current)} onDelete={() => clearRun(shownRun.autoName)} />
              </Tooltip>)}
            {view === "field" && <Tooltip title={livePose ? "Insert a drive point at the robot's live position" : "Connect to a robot to use its position"}>
              <span><Button size="small" startIcon={<MyLocationIcon />} disabled={!auto || !livePose} sx={{ whiteSpace: "nowrap" }}
                onClick={() => livePose && auto && fieldAddPoint(Math.round(livePose.x * 100) / 100, Math.round(livePose.y * 100) / 100)}>
                Point at robot
              </Button></span>
            </Tooltip>}
            {view === "field" && <Tooltip title={layout
              ? "Show what each camera can see, and which AprilTags the robot could place itself with along the route"
              : "Pick a field layout in the View menu to see AprilTags"}>
              <span><ToggleButton size="small" value="tags" selected={showTags} disabled={!layout} sx={{ px: 1, whiteSpace: "nowrap" }}
                onChange={() => { setShowTags(current => !current); if (!showTags && document.cameras.length === 0) setCamerasOpen(true); }}>
                <VisibilityIcon fontSize="small" sx={{ mr: 0.5 }} />Tags
              </ToggleButton></span>
            </Tooltip>}
            {showTags && <Tooltip title="Where each Limelight sits on the robot">
              <IconButton size="small" aria-label="Cameras" onClick={() => setCamerasOpen(true)}><VideocamIcon fontSize="small" /></IconButton>
            </Tooltip>}
            <Tooltip title="Keyboard shortcuts (?)">
              <IconButton size="small" aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}><KeyboardIcon fontSize="small" /></IconButton>
            </Tooltip>
          </div>
          <div className="ab-stage">
            {view === "code"
              ? <pre className="ab-code" aria-label="Generated Java">{generated}</pre>
              : <AutoField auto={routeAuto} field={field} layout={layout} robot={files.robot} stateColor={stateColor} selectedStepIds={selection}
                driveNumbers={driveNumbers} ghosts={ghosts}
                replay={replay} pose={fieldPose} onSelectSteps={selectSteps} onAddPoint={fieldAddPoint} onMovePoints={movePoints}
                onChangeHeading={(stepId, heading) => fieldChangePoint(stepId, { heading })} onChangeSubpoint={changeSubpoint}
                replaying={replayTime !== null} points={viewingMirror ? [] : document.points} onAddFromPoint={addFromPoint}
                onChangeFace={changeFace} actual={shownRun && (shownRun === recording || showActual) ? shownRun.points : undefined}
                vision={visionOverlay} />}
            {view === "field" && frame && <Chip className="ab-replay-pill" size="small" color="primary"
              label={`Replay · ${frame.speed.toFixed(1)} m/s${replayState ? ` · ${replayState}` : ""}`} />}
          </div>
          <Divider />
          <AutoReplayBar replay={replay} time={replayTime} playing={playing} speed={replaySpeed} stateColor={stateColor} activeStepId={activeStepId}
            period={document.periodSeconds} onPeriod={seconds => change(current => ({ ...current, periodSeconds: seconds }))}
            robotCheck={speed && drivetrain ? { summary: describeLimits(drivetrain), extraSeconds: speed.extraSeconds, robotDuration: speed.robot.duration,
              strain: speed.strain, notes: drivetrain.notes } : undefined}
            vision={vision ?? undefined}
            stepColor={stepId => { const step = allSteps(auto?.steps ?? []).find(candidate => candidate.id === stepId); return step && (step.type === "requestState" || step.type === "waitForState") ? stateColor(step.state) : undefined; }}
            stepNumber={stepId => stepNumbers.get(stepId)}
            onPlay={startReplay}
            onPause={() => setPlaying(false)} onStop={stopReplay}
            onSeek={time => { setPlaying(false); setReplayTime(time); }} onSpeed={setReplaySpeed} onSelectStep={setSelectedStepId} />
        </div>
      </section>

      <ColumnSplitter side="right" layout={columns} onChange={setColumns} />

      {/* Steps in run order, and the selected step's settings. */}
      <section className={`ab-pane${columns.rightOpen ? "" : " collapsed"}`}>
        <div className="ab-pane-header">
          <Typography sx={{ fontWeight: 600, flex: 1 }}>Steps{auto ? ` (${stepNumbers.size})` : ""}</Typography>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={!auto} onClick={event => setAddMenu({ anchor: event.currentTarget })}>Add step</Button>
          {/* Branches can't hold branches, so a side of a branch doesn't offer one. */}
          <Menu anchorEl={addMenu?.anchor} open={addMenu !== null} onClose={() => setAddMenu(null)}>
            {(Object.keys(stepLabels) as AutoStepType[]).filter(type => !(addInto && type === "branch")).map(type =>
              <MenuItem key={type} onClick={() => { addStep(type, addInto ? { into: addInto } : undefined); setAddMenu(null); }}>
                <ListItemIcon>{stepIcons[type]}</ListItemIcon>
                <ListItemText primary={stepLabels[type]} secondary={stepDescriptions[type]} />
              </MenuItem>)}
          </Menu>
        </div>
        {!auto ? <div className="ab-pane-body"><Typography color="text.secondary" variant="body2">Pick an auto to see its steps.</Typography></div> : <>
          <div className="ab-pane-body" style={selection.length ? { flex: "0 1 auto", maxHeight: "45%" } : undefined}>
            {auto.steps.length === 0
              ? <Typography variant="body2" color="text.secondary">Click the field to add drive points, or use Add step.</Typography>
              : <StepList steps={auto.steps} choices={choices} selectedStepIds={selection} activeStepId={activeStepId} durations={durations} issues={autoIssues}
                stateColor={stateColor} onSelect={(stepId, toggle) => selectSteps([stepId], toggle ? "toggle" : "replace")} onReorder={moveStepsTo} onDelete={deleteStep}
                onShowArm={showArm} onAddTo={(into, anchor) => setAddMenu({ anchor, into })} />}
          </div>
          {selection.length > 0 && <div className="ab-pane-body ab-inspector">
            {selection.length > 1
              ? <MultiStepInspector steps={stepsInOrder(selection)} onApplyLimits={limits => applyLimits(selection, limits)} onAlign={alignSelected}
                onDuplicate={() => insertSteps(stepsToCopy(selection).map(cloneStep))} onDelete={() => deleteSteps(selection)} />
              : selectedStep
              ? <StepInspector key={selectedStep.id} step={selectedStep} states={files.states} mirrored={viewingMirror}
                driveNumber={driveNumbers.get(selectedStep.id) ?? 0} branch={branchView}
                issues={autoIssues.filter(issue => issue.stepId === selectedStep.id)} legInfo={legInfo} drivetrain={files.loading ? undefined : drivetrain}
                points={document.points} onChange={patch => updateStep(selectedStep.id, patch)} onApplyLimitsToAll={applyLimitsToAll}
                onLinkPoint={pointId => linkPoint(selectedStep.id, pointId)}
                onSavePoint={() => selectedStep.type === "drive" && savePoint(selectedStep)}
                onRenamePoint={name => selectedStep.type === "drive" && selectedStep.pointId && renamePoint(selectedStep.pointId, name)} />
              : null}
          </div>}
        </>}
      </section>

      <CameraDialog open={camerasOpen} cameras={document.cameras} robotCameraNames={files.vision?.cameraNames ?? []}
        onChange={cameras => change(current => ({ ...current, cameras }), "cameras")} onClose={() => setCamerasOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Snackbar open={message !== null} autoHideDuration={message?.severity === "error" ? 9000 : 4000} onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        {message ? <Alert severity={message.severity} variant="filled" onClose={() => setMessage(null)}>{message.text}</Alert> : undefined}
      </Snackbar>
    </div>
  );
}

/** Named points shared by every auto; moving one moves each step linked to it. */
function PointList({ points, autos, canAdd, onAdd, onRename, onDelete }: {
  points: NamedPoint[];
  autos: AutoRoutine[];
  canAdd: boolean;
  onAdd: (pointId: string) => void;
  onRename: (pointId: string, name: string) => void;
  onDelete: (point: NamedPoint) => void;
}) {
  const uses = (pointId: string) => autos.reduce((count, auto) => count + allSteps(auto.steps).filter(step => step.type === "drive"
    && (step.pointId === pointId || (step.turn.mode === "face" && step.turn.pointId === pointId))).length, 0);
  return <div className="ab-points">
    <Tooltip placement="right" title="Save a drive step's pose as a named point, then reuse it in any auto. Moving a point moves every step linked to it.">
      <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, display: "block" }}>Points</Typography>
    </Tooltip>
    {points.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, display: "block" }}>
      Save a step as a point to reuse it.
    </Typography>}
    {points.map(point => {
      const count = uses(point.id);
      return <div key={point.id} className="ab-point">
        <span className="ab-point-dot" />
        <span style={{ minWidth: 0, flex: 1 }}>
          <input className="ab-point-name" value={point.name} aria-label="Point name" spellCheck={false}
            onChange={event => onRename(point.id, event.target.value)} />
          <span className="ab-auto-meta">{point.x.toFixed(2)}, {point.y.toFixed(2)} m · {count === 0 ? "unused" : `${count} step${count === 1 ? "" : "s"}`}</span>
        </span>
        <Tooltip title={canAdd ? "Drive here in this auto" : "Pick an auto (not the mirrored copy) to drive here"}>
          <span><IconButton size="small" aria-label={`Drive to ${point.name}`} disabled={!canAdd} onClick={() => onAdd(point.id)}>
            <AddLocationIcon fontSize="small" />
          </IconButton></span>
        </Tooltip>
        <Tooltip title="Delete point (linked steps keep their spot)">
          <IconButton size="small" aria-label={`Delete ${point.name}`} onClick={() => onDelete(point)}><DeleteIcon fontSize="small" /></IconButton>
        </Tooltip>
      </div>;
    })}
  </div>;
}

/** Right-click menu for an auto in the list. */
function AutoContextMenu({ menu, auto, onClose, onDuplicate, onFlip, onDelete, onDefault, onToggleClear }: {
  menu: { id: string; x: number; y: number } | null;
  auto: AutoRoutine | null;
  onClose: () => void;
  onDuplicate: (id: string) => void;
  onFlip: (id: string, flips: Symmetry) => void;
  onDelete: (id: string) => void;
  onDefault: (id: string, checked: boolean) => void;
  onToggleClear: (id: string) => void;
}) {
  const run = (action: (id: string) => void) => () => { if (menu) action(menu.id); onClose(); };
  return <Menu open={menu !== null && auto !== null} onClose={onClose} anchorReference="anchorPosition"
    anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined} slotProps={{ list: { dense: true } }}>
    <MenuItem onClick={run(onDuplicate)}>
      <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon><ListItemText>Duplicate</ListItemText>
    </MenuItem>
    <MenuItem onClick={run(id => onFlip(id, { flipX: true, flipY: false }))}>
      <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon><ListItemText>Flip points across center line</ListItemText>
    </MenuItem>
    <MenuItem onClick={run(id => onFlip(id, { flipX: false, flipY: true }))}>
      <ListItemIcon><SwapVertIcon fontSize="small" /></ListItemIcon><ListItemText>Flip points top to bottom</ListItemText>
    </MenuItem>
    <Divider />
    <MenuItem onClick={run(id => onDefault(id, !auto?.isDefault))}>
      <ListItemIcon>{auto?.isDefault ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}</ListItemIcon>
      <ListItemText>{auto?.isDefault ? "Remove as default" : "Make default"}</ListItemText>
    </MenuItem>
    <MenuItem onClick={run(onToggleClear)}>
      <ListItemIcon><Checkbox size="small" checked={auto?.clearRequestsAtEnd ?? false} sx={{ p: 0 }} /></ListItemIcon>
      <ListItemText>Clear state requests at the end</ListItemText>
    </MenuItem>
    <Divider />
    <MenuItem onClick={run(onDelete)} sx={{ color: "error.main" }}>
      <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete</ListItemText>
    </MenuItem>
  </Menu>;
}
