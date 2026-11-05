import { useMemo, useState } from "react";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { useFieldLayout } from "../field/useFieldLayout";
import { autoActions } from "./autoActions";
import { autoFieldSize } from "./autoCode";
import { describeLimits } from "./autoLimits";
import type { Symmetry } from "./autoModel";
import { allSteps } from "./autoModel";
import { cameraOverlay, legReplayInfo, overlayPose, replayMoment, stepAccent } from "./autoView";
import type { EditorContext } from "./editorContext";
import { fieldActions } from "./fieldActions";
import { pointActions } from "./pointActions";
import { stepActions } from "./stepActions";
import type { AutoMessage, AutoView, RobotCheck } from "./types";
import { useAutoAnalysis } from "./useAutoAnalysis";
import { useAutoFiles } from "./useAutoFiles";
import { useAutoHistory } from "./useAutoHistory";
import { useAutoSave } from "./useAutoSave";
import { useAutoSelection } from "./useAutoSelection";
import { useAutoShortcuts } from "./useAutoShortcuts";
import { useBranchChoices } from "./useBranchChoices";
import { useLivePose } from "./useLivePose";
import { useReplayPlayback } from "./useReplayPlayback";
import { useRunRecorder } from "./useRunRecorder";

/** Everything the Auto Builder panel shows and does, put together from the feature's hooks and actions. */
export function useAutoBuilder() {
  const api = window.powerlib;
  const { status } = useNetworkTables();
  const topics = useTopics("drive");
  const livePose = useLivePose(topics, status === "connected");
  const runs = useRunRecorder(topics, status === "connected");
  const history = useAutoHistory();
  const { document, change } = history;
  const [message, setMessage] = useState<AutoMessage | null>(null);
  const selection = useAutoSelection(document);
  const { files, load } = useAutoFiles(api, next => { history.reset(next); saving.markSaved(next); selection.keepAutoIn(next); });
  const saving = useAutoSave(api, document, files.loading, setMessage);
  const [view, setView] = useState<AutoView>("field");
  const [showMirror, setShowMirror] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [camerasOpen, setCamerasOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const layout = useFieldLayout();
  const field = useMemo(() => layout ? { length: layout.length, width: layout.width } : autoFieldSize(), [layout]);
  const { auto, selectedStepId } = selection;
  const { choices, showArm } = useBranchChoices(auto, selectedStepId);
  const analysis = useAutoAnalysis({ document, auto, files, field, layout, showMirror, showTags, choices });
  const { replay, stateColor, speed, drivetrain } = analysis;
  const playback = useReplayPlayback(replay.duration);
  const moment = replayMoment(replay, playback.time);

  const selectAuto = (id: string | null) => { selection.setSelectedAutoId(id); selection.selectStep(null); setShowMirror(false); playback.stop(); };
  const context: EditorContext = { document, change, auto, mirror: analysis.mirror, viewingMirror: analysis.viewingMirror, field, project: analysis.project,
    choices, showArm, selectedAutoId: selection.selectedAutoId, selectAuto, selection: selection.selection, selectedStepId,
    setSelection: selection.setSelection, notify: setMessage };
  const steps = stepActions(context);
  const editor = { steps, autos: autoActions(context, steps), field: fieldActions(context, steps), points: pointActions(context, steps) };

  useAutoShortcuts({ auto, selection: selection.selection, selectedStepId, setSelection: selection.setSelection, steps, field: editor.field,
    save: saving.save, undo: history.undo, redo: history.redo, openHelp: () => setShortcutsOpen(true), notify: setMessage,
    playPause: () => { if (playback.playing) playback.pause(); else if (replay.frames.length) playback.play(); } });

  const ordered = allSteps(auto?.steps ?? []);
  const selectedStep = ordered.find(step => step.id === selectedStepId) ?? null;
  const robotCheck: RobotCheck | undefined = speed && drivetrain ? { summary: describeLimits(drivetrain), extraSeconds: speed.extraSeconds,
    robotDuration: speed.robot.duration, strain: speed.strain, notes: drivetrain.notes } : undefined;
  // The cameras at the pose on the field: while replaying that is the playhead, otherwise the live robot or the start.
  const visionOverlay = cameraOverlay(analysis.vision, playback.time ?? 0, overlayPose(moment.pose, livePose, analysis.routeAuto?.steps ?? []),
    document.cameras, analysis.visionLimits.maxTagDistance);

  return {
    api, files, document, history, saving, selection, choices, showArm, analysis, playback, moment, editor, livePose, layout, field,
    view, setView, showTags, camerasOpen, setCamerasOpen, shortcutsOpen, setShortcutsOpen, message, setMessage, selectAuto,
    selectedStep, robotCheck, visionOverlay,
    stepCount: ordered.length,
    legInfo: legReplayInfo(replay, selectedStep, speed?.extraByStep),
    reachedAt: selectedStep ? replay.segments.find(segment => segment.stepId === selectedStep.id)?.start : undefined,
    /** The run being recorded, or the last recorded one, for the auto on the field. */
    run: analysis.shownAuto ? runs.runFor(analysis.shownAuto.name) : undefined,
    runs,
    stepColor: (stepId: string) => stepAccent(ordered.find(step => step.id === stepId), stateColor),
    reload: () => { if (!saving.dirty || window.confirm("Discard unsaved auto changes and reload?")) void load(); },
    toggleTags: () => { setShowTags(current => !current); if (!showTags && document.cameras.length === 0) setCamerasOpen(true); },
    showMirrorCopy: (value: boolean) => { setShowMirror(value); playback.stop(); },
    setSymmetry: (symmetry: Symmetry) => { editor.autos.setSymmetry(symmetry); if (!symmetry.flipX && !symmetry.flipY) setShowMirror(false); }
  };
}
