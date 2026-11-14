import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Alert, IconButton, LinearProgress, Stack } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { GeneratedSubsystem } from "../subsystems/types";
import { buildLogModel, busiestMechanism, canPercentAt } from "./logModel";
import type { GraphView } from "./logModel";
import type { SavedLog } from "./logLibraryModel";
import { groupColor, logDetails, readSaved, writeSaved } from "./logUtils";
import { useDashboardSettings } from "../dashboard/useDashboardSettings";
import { useFieldLayout } from "../field/useFieldLayout";
import { useLoadedLogs } from "./useLoadedLogs";
import { useLogPlayback } from "./useLogPlayback";
import { FieldView } from "./components/FieldView";
import { LogLibrary } from "./components/LogLibrary";
import { LogsDialog } from "./components/LogsDialog";
import { LogsDrawer } from "./components/LogsDrawer";
import { LogStatusBar } from "./components/LogStatusBar";
import { MotorAssignDialog } from "./components/MotorAssignDialog";
import { RobotLogsButton } from "./components/RobotLogsButton";
import { OpenLogPrompt } from "./components/OpenLogPrompt";
import { PlayBar } from "./components/PlayBar";
import { PowerCard } from "./components/PowerCard";
import { SubsystemGraphs } from "./components/SubsystemGraphs";
import { LogsLayout } from "./components/LogsLayout";

type LogsContentProps = {
  active: boolean;
  subsystems: GeneratedSubsystem[];
};

const selectionKey = "powerlib.logs.mechanisms.v1";
const assignmentsKey = "powerlib.logs.motorGroups.v1";
const viewsKey = "powerlib.logs.graphViews.v1";

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const isStringMap = (value: unknown): value is Record<string, string> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(item => typeof item === "string");
/** The subsystems picked last time, so the next log opens on the same ones. */
const readSavedSelection = () => readSaved(selectionKey, [], isStringList);

/** The Logs tab: fills the window without scrolling the page; long widgets scroll on their own. */
export function LogsContent({ active, subsystems }: LogsContentProps) {
  const { loaded, loading, error, setError, openLog, openFiles, openSaved, keptIds } = useLoadedLogs();
  const [dragging, setDragging] = useState(false);
  const [showingLogs, setShowingLogs] = useState(false);
  const [mechanismIds, setMechanismIds] = useState<string[]>([]);
  const [assigningMotors, setAssigningMotors] = useState(false);
  /** Motor key â†’ subsystem or group, chosen in the Assign motors dialog; overrides robot Java configuration. */
  const [assignments, setAssignments] = useState<Record<string, string>>(() => readSaved(assignmentsKey, {}, isStringMap));
  /** Subsystem id â†’ what its graph shows (value, current, power, voltage, stator or temp). */
  const [views, setViews] = useState<Record<string, GraphView>>(() => readSaved(viewsKey, {}, isStringMap) as Record<string, GraphView>);
  /** Swerve motor IDs from the robot's TunerConstants.java, so a log's drive motors group as Drive without setup. */
  const [driveMotorIds, setDriveMotorIds] = useState<number[]>([]);
  useEffect(() => {
    window.powerlib?.readDriveMotorIds?.().then(setDriveMotorIds).catch(() => setDriveMotorIds([]));
  }, []);
  const model = useMemo(() => (loaded ? buildLogModel(loaded.sources, subsystems, assignments, driveMotorIds) : null),
    [loaded, subsystems, assignments, driveMotorIds]);
  const settings = useDashboardSettings();
  const layout = useFieldLayout();
  const field = { length: layout?.length ?? settings.length, width: layout?.width ?? settings.width, flip: settings.flip };
  const duration = model?.duration ?? 0;
  const playback = useLogPlayback(duration, active, model !== null);
  const { time, setTime, setPlaying } = playback;
  const selected = useMemo(() => mechanismIds.flatMap(id => model?.mechanisms.find(item => item.id === id) ?? []), [mechanismIds, model]);

  function selectMechanisms(ids: string[]) {
    setMechanismIds(ids);
    writeSaved(selectionKey, ids);
  }

  function assignMotor(key: string, group: string | null) {
    setAssignments(current => {
      const next = { ...current };
      if (group === null) delete next[key]; else next[key] = group;
      writeSaved(assignmentsKey, next);
      return next;
    });
  }

  function clearAssignments() {
    setAssignments({});
    writeSaved(assignmentsKey, {});
  }

  function setView(id: string, view: GraphView) {
    setViews(current => {
      const next = { ...current, [id]: view };
      writeSaved(viewsKey, next);
      return next;
    });
  }

  // A new log starts paused at its first enabled period; reassigning motors rebuilds the model but keeps the time.
  useEffect(() => {
    setPlaying(false);
    if (model) setTime(model.periods[0]?.start ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!model) return;
    setMechanismIds(current => {
      const exists = (id: string) => model.mechanisms.some(item => item.id === id);
      const kept = current.filter(exists);
      if (kept.length) return kept;
      const saved = readSavedSelection().filter(exists);
      const busiest = busiestMechanism(model.mechanisms)?.id;
      return saved.length ? saved : busiest ? [busiest] : [];
    });
  }, [model]);

  const dropProps = {
    onDragOver: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(false); openFiles(Array.from(event.dataTransfer.files)); }
  };

  function openFromList(log: SavedLog) {
    setShowingLogs(false);
    openSaved(log);
  }

  const library = (
    <LogLibrary openId={loaded?.id} keptIds={keptIds} loading={loading} onOpen={openFromList}
      onOpenFile={() => { setShowingLogs(false); openLog(); }}
      action={<IconButton size="small" aria-label="Close logs" onClick={() => setShowingLogs(false)}><CloseIcon fontSize="small" /></IconButton>} />
  );

  if (!loaded || !model) {
    return (
      <Stack spacing={2} {...dropProps} sx={{ flex: 1, minHeight: 0 }}>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        <OpenLogPrompt dragging={dragging} loading={loading} onOpen={() => setShowingLogs(true)}
          actions={<RobotLogsButton variant="outlined" onOpenLog={openSaved} />} />
        <LogsDialog open={showingLogs} onClose={() => setShowingLogs(false)}>{library}</LogsDialog>
      </Stack>
    );
  }

  const noPowerLib = model.mechanisms.length === 0 && !model.battery && !model.pose && !model.state;

  return (
    <Stack spacing={1.5} {...dropProps}
      sx={{ flex: 1, minHeight: 0, outline: dragging ? "2px dashed" : "none", outlineColor: "primary.main", borderRadius: 2 }}>
      {loading && <LinearProgress />}
      {error && <Alert severity={error.startsWith("The end of this log") ? "warning" : "error"} onClose={() => setError(null)}>{error}</Alert>}
      {noPowerLib && <Alert severity="info">No PowerLib data found in this log ({model.signalCount} signals). The viewer looks for PowerLib/Subsystems/&lt;name&gt;/Data/&lt;key&gt; signals or /PowerLib/Data frames.</Alert>}
      <LogsLayout
        graphs={<SubsystemGraphs subsystems={model.mechanisms} selected={selected} onSelect={selectMechanisms} views={views} onView={setView} time={time}
          colorOf={id => (model.powerGroups.some(group => group.id === id) ? groupColor(id, model.powerGroups) : undefined)} />}
        field={<FieldView pose={model.pose} swerve={model.swerve} periods={model.periods} time={time} field={field} layout={layout} orientation="vertical"
          sx={model.pose || model.swerve ? { flex: "1 1 0", minHeight: 210 } : { flexShrink: 0 }} />}
        power={<PowerCard allGroups={model.powerGroups} selected={selected} battery={model.battery} motorCount={model.motors.length} time={time}
          onAssign={() => setAssigningMotors(true)} graphHeight={180} sx={{ flex: "1 1 0", minHeight: 230 }} />} />
      <PlayBar time={time} duration={duration} playing={playback.playing} speed={playback.speed} periods={model.periods} state={model.state}
        matchTime={model.matchTime} fmsAttached={model.fmsAttached}
        onTogglePlay={playback.togglePlay} onCycleSpeed={playback.cycleSpeed} onSeek={playback.seek} />
      <LogStatusBar name={loaded.name} converted={loaded.converted} onShowLogs={() => setShowingLogs(true)}
        details={logDetails(duration, model.buses, model.signalCount, model.motors.length, model.usedFrames)} canPercent={canPercentAt(model.can, time)} />
      <LogsDrawer open={showingLogs} onClose={() => setShowingLogs(false)}>{library}</LogsDrawer>
      <MotorAssignDialog open={assigningMotors} onClose={() => setAssigningMotors(false)} motors={model.motors} mechanisms={model.mechanisms}
        overrides={assignments} onAssign={assignMotor} onReset={clearAssignments} />
    </Stack>
  );
}
