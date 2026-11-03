import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Alert, Box, LinearProgress, Stack } from "@mui/material";
import type { GeneratedSubsystem } from "../subsystems/types";
import { template } from "../drive/driveModel";
import { buildLogModel, busiestMechanism, canPercentAt } from "./logModel";
import type { GraphView } from "./logModel";
import { groupColor, logDetails, readSaved, writeSaved } from "./logUtils";
import { useLogFile } from "./useLogFile";
import { useLogPlayback } from "./useLogPlayback";
import { FieldView } from "./components/FieldView";
import { LogStatusBar } from "./components/LogStatusBar";
import { MotorAssignDialog } from "./components/MotorAssignDialog";
import { OpenLogPrompt } from "./components/OpenLogPrompt";
import { PlayBar } from "./components/PlayBar";
import { PowerCard } from "./components/PowerCard";
import { SubsystemGraphs } from "./components/SubsystemGraphs";
import { LogsLayout } from "./components/LogsLayout";

type LogsPanelProps = {
  active: boolean;
  subsystems: GeneratedSubsystem[];
};

const driveSettingsKey = "powerlib.driveDisplay.v1";
const selectionKey = "powerlib.logs.mechanisms.v1";
const assignmentsKey = "powerlib.logs.motorGroups.v1";
const viewsKey = "powerlib.logs.graphViews.v1";

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const isStringMap = (value: unknown): value is Record<string, string> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(item => typeof item === "string");
/** The subsystems picked last time, so the next log opens on the same ones. */
const readSavedSelection = () => readSaved(selectionKey, [], isStringList);

/** Use the same field size and flip the Drive tab is set to on this machine. */
function readFieldSettings() {
  const defaults = { length: template.field.lengthMeters, width: template.field.widthMeters, flip: false };
  try {
    const saved = JSON.parse(localStorage.getItem(driveSettingsKey) || "{}");
    return {
      length: typeof saved.length === "number" && saved.length > 0 ? saved.length : defaults.length,
      width: typeof saved.width === "number" && saved.width > 0 ? saved.width : defaults.width,
      flip: saved.flip === true
    };
  } catch {
    return defaults;
  }
}

/** The Logs tab: fills the window without scrolling the page; long widgets scroll on their own. */
export function LogsPanel({ active, subsystems }: LogsPanelProps) {
  const { loaded, loading, error, setError, openLog, openFiles } = useLogFile();
  const [dragging, setDragging] = useState(false);
  const [mechanismIds, setMechanismIds] = useState<string[]>([]);
  const [assigningMotors, setAssigningMotors] = useState(false);
  /** Motor key → subsystem or group, chosen in the Assign motors dialog; overrides powerlib-subsystems.json. */
  const [assignments, setAssignments] = useState<Record<string, string>>(() => readSaved(assignmentsKey, {}, isStringMap));
  /** Subsystem id → what its graph shows (value, current, power, voltage, stator or temp). */
  const [views, setViews] = useState<Record<string, GraphView>>(() => readSaved(viewsKey, {}, isStringMap) as Record<string, GraphView>);
  /** Swerve motor IDs from the robot's TunerConstants.java, so a log's drive motors group as Drive without setup. */
  const [driveMotorIds, setDriveMotorIds] = useState<number[]>([]);
  useEffect(() => {
    window.powerlib?.readDriveMotorIds?.().then(setDriveMotorIds).catch(() => setDriveMotorIds([]));
  }, []);
  const model = useMemo(() => (loaded ? buildLogModel(loaded.sources, subsystems, assignments, driveMotorIds) : null),
    [loaded, subsystems, assignments, driveMotorIds]);
  const field = useMemo(readFieldSettings, [active]);
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

  if (!loaded || !model) {
    return (
      <Stack spacing={2} {...dropProps}>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        <OpenLogPrompt dragging={dragging} loading={loading} onOpen={openLog} />
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
        field={<FieldView pose={model.pose} periods={model.periods} time={time} field={field} orientation="vertical"
          sx={model.pose ? { flex: "1 1 0", minHeight: 210 } : { flexShrink: 0 }} />}
        power={<PowerCard allGroups={model.powerGroups} selected={selected} battery={model.battery} motorCount={model.motors.length} time={time}
          onAssign={() => setAssigningMotors(true)} graphHeight={180} sx={{ flex: "1 1 0", minHeight: 230 }} />} />
      <PlayBar time={time} duration={duration} playing={playback.playing} speed={playback.speed} periods={model.periods} state={model.state}
        matchTime={model.matchTime} fmsAttached={model.fmsAttached}
        onTogglePlay={playback.togglePlay} onCycleSpeed={playback.cycleSpeed} onSeek={playback.seek} />
      <LogStatusBar name={loaded.name} converted={loaded.converted} loading={loading} onOpen={openLog}
        details={logDetails(duration, model.buses, model.signalCount, model.motors.length, model.usedFrames)} canPercent={canPercentAt(model.can, time)} />
      <MotorAssignDialog open={assigningMotors} onClose={() => setAssigningMotors(false)} motors={model.motors} mechanisms={model.mechanisms}
        overrides={assignments} onAssign={assignMotor} onReset={clearAssignments} />
    </Stack>
  );
}
