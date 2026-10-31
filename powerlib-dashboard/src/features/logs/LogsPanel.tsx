import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Alert, Box, Button, Chip, IconButton, LinearProgress, Paper, Slider, Stack, Tooltip, Typography } from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LanIcon from "@mui/icons-material/Lan";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TimelineIcon from "@mui/icons-material/Timeline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { GeneratedSubsystem } from "../subsystems/types";
import { template } from "../drive/driveModel";
import { buildLogModel, busiestMechanism, valueAt } from "./logModel";
import type { LogMarker } from "./logModel";
import { parseWpilog } from "./wpilog";
import type { WpilogFile } from "./wpilog";
import { FieldView, formatClock, markerColors, MechanismGraphs, MechanismStatus, NumberTile, StateStrip, TimelineBar } from "./LogWidgets";

type LoadedLog = { name: string; converted: boolean; file: WpilogFile };
const speeds = [0.5, 1, 2, 4];
const driveSettingsKey = "powerlib.driveDisplay.v1";
const selectionKey = "powerlib.logs.mechanisms.v1";

/** The mechanisms picked last time, so the next log opens on the same ones. */
function readSavedSelection(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(selectionKey) || "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
const markerIcons: Record<LogMarker["kind"], typeof BoltIcon> = { brownout: BoltIcon, setpoint: WarningAmberIcon, can: LanIcon };

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

const cleanError = (caught: unknown) =>
  (caught instanceof Error ? caught.message : String(caught)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");

export function LogsPanel({ active, subsystems }: { active: boolean; subsystems: GeneratedSubsystem[] }) {
  const [loaded, setLoaded] = useState<LoadedLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mechanismIds, setMechanismIds] = useState<string[]>([]);
  const model = useMemo(() => (loaded ? buildLogModel(loaded.file, subsystems) : null), [loaded, subsystems]);
  const field = useMemo(readFieldSettings, [active]);
  const duration = model?.duration ?? 0;
  const selected = useMemo(() => mechanismIds.flatMap(id => model?.mechanisms.find(item => item.id === id) ?? []), [mechanismIds, model]);

  function selectMechanisms(ids: string[]) {
    setMechanismIds(ids);
    try {
      localStorage.setItem(selectionKey, JSON.stringify(ids));
    } catch {
      // Keep this session's selection when browser storage is unavailable.
    }
  }

  const seek = useCallback((next: number) => setTime(Math.min(duration, Math.max(0, next))), [duration]);

  function load(bytes: Uint8Array, name: string, converted: boolean) {
    const file = parseWpilog(bytes);
    setLoaded({ name, converted, file });
    setPlaying(false);
    setError(file.truncated ? "The end of this log was cut off (the robot may have lost power). Everything before that point is shown." : null);
  }

  useEffect(() => {
    if (!model) return;
    setTime(model.periods[0]?.start ?? 0);
    const saved = readSavedSelection().filter(id => model.mechanisms.some(item => item.id === id));
    const busiest = busiestMechanism(model.mechanisms)?.id;
    setMechanismIds(saved.length ? saved : busiest ? [busiest] : []);
  }, [model]);

  async function run(task: () => Promise<void>) {
    setLoading(true);
    try {
      await task();
    } catch (caught) {
      setError(cleanError(caught));
    } finally {
      setLoading(false);
    }
  }

  function openLog() {
    void run(async () => {
      if (!window.powerlib?.openLog) throw new Error("Opening files needs the Power Tool app. Drag a .wpilog file here instead.");
      const result = await window.powerlib.openLog();
      if (!result.canceled) load(result.bytes, result.name, result.converted);
    });
  }

  function dropLog(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    void run(async () => {
      if (/\.hoot$/i.test(file.name)) {
        const filePath = window.powerlib?.getPathForFile?.(file);
        if (!filePath || !window.powerlib?.openLogPath) throw new Error("Opening .hoot files needs the Power Tool app.");
        const result = await window.powerlib.openLogPath(filePath);
        load(result.bytes, result.name, result.converted);
      } else {
        load(new Uint8Array(await file.arrayBuffer()), file.name, false);
      }
    });
  }

  useEffect(() => {
    if (!playing || !active) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = ((now - last) / 1000) * speed;
      last = now;
      setTime(current => {
        const next = current + elapsed;
        if (next >= duration) { setPlaying(false); return duration; }
        return next;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, active, speed, duration]);

  useEffect(() => {
    if (!active || !model) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || target.getAttribute("role") === "combobox")) return;
      if (event.code === "Space") { event.preventDefault(); setPlaying(current => !current); }
      else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const jump = (event.shiftKey ? 5 : 1) * (event.key === "ArrowRight" ? 1 : -1);
        setTime(current => Math.min(duration, Math.max(0, current + jump)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, model, duration]);

  useEffect(() => { if (!active) setPlaying(false); }, [active]);

  const dropProps = {
    onDragOver: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: dropLog
  };

  if (!loaded || !model) {
    return (
      <Stack spacing={2} {...dropProps}>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        <Paper variant="outlined" sx={{ p: 6, borderRadius: 2, borderStyle: "dashed", borderColor: dragging ? "primary.main" : "divider",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
          <TimelineIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Open a robot log</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
            Choose a .wpilog or .hoot file, or drag one here. .hoot files are converted with CTRE's Owlet, which needs to be in power-tool/tools/ or on PATH.
          </Typography>
          <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={openLog} disabled={loading}>Open log</Button>
          {loading && <LinearProgress sx={{ width: 240 }} />}
        </Paper>
      </Stack>
    );
  }

  const battery = valueAt(model.battery, time);
  const can = valueAt(model.can, time);
  const canPercent = can !== undefined && model.can && Math.max(...model.can.values.filter(Number.isFinite)) <= 1.5 ? can * 100 : can;
  const period = model.periods.find(item => time >= item.start && time < item.end);
  const noPowerLib = model.mechanisms.length === 0 && !model.battery && !model.pose && !model.state;

  return (
    <Stack spacing={1.5} {...dropProps} sx={{ outline: dragging ? "2px dashed" : "none", outlineColor: "primary.main", borderRadius: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Button variant="outlined" size="small" startIcon={<FolderOpenIcon />} onClick={openLog} disabled={loading}>Open log</Button>
        <Typography sx={{ fontWeight: 800 }}>{loaded.name}</Typography>
        {loaded.converted && <Chip size="small" variant="outlined" label="Converted from .hoot" />}
        <Typography variant="caption" color="text.secondary">{formatClock(duration)} long · {model.signalCount} signals{model.usedFrames ? " · from 10 Hz NT frames" : ""}</Typography>
        <Box sx={{ flex: 1 }} />
        {model.periods.length > 0 && <Typography variant="caption" color="text.secondary">Jump to:</Typography>}
        {model.periods.map(item => (
          <Chip key={item.start} size="small" label={item.label} clickable color={period === item ? "primary" : "default"}
            variant={period === item ? "filled" : "outlined"} onClick={() => seek(item.start)} />
        ))}
      </Stack>
      {loading && <LinearProgress />}
      {error && <Alert severity={error.startsWith("The end of this log") ? "warning" : "error"} onClose={() => setError(null)}>{error}</Alert>}
      {noPowerLib && <Alert severity="info">No PowerLib data found in this log ({model.signalCount} signals). The viewer looks for PowerLib/Subsystems/&lt;name&gt;/Data/&lt;key&gt; signals or /PowerLib/Data frames.</Alert>}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
          <Tooltip title="Play or pause (Space)">
            <IconButton size="small" color="primary" onClick={() => {
              if (!playing && time >= duration) setTime(0);
              setPlaying(current => !current);
            }} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </Tooltip>
          <Button size="small" variant="outlined" sx={{ minWidth: 48 }} onClick={() => setSpeed(current => speeds[(speeds.indexOf(current) + 1) % speeds.length])}>
            {speed}x
          </Button>
          <Typography sx={{ fontWeight: 700, minWidth: 150, fontVariantNumeric: "tabular-nums" }}>
            {formatClock(time)}{period ? ` · ${period.label}` : " · disabled"}
          </Typography>
          {canPercent !== undefined && Number.isFinite(canPercent) && (
            <Typography variant="caption" color="text.secondary">CAN {canPercent.toFixed(0)}%</Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">{model.markers.length ? "Problems:" : "No problems flagged"}</Typography>
          <Stack direction="row" sx={{ gap: 0.75, overflowX: "auto", maxWidth: "60%" }}>
            {model.markers.map(marker => {
              const Icon = markerIcons[marker.kind];
              return (
                <Chip key={`${marker.kind}-${marker.time}-${marker.mechanismId ?? ""}`} size="small" variant="outlined" clickable
                  icon={<Icon sx={{ color: `${markerColors[marker.kind]} !important` }} />} label={`${marker.label} · ${formatClock(marker.time)}`}
                  onClick={() => {
                    if (marker.mechanismId && !mechanismIds.includes(marker.mechanismId)) selectMechanisms([...mechanismIds, marker.mechanismId]);
                    seek(marker.time - 1);
                  }} />
              );
            })}
          </Stack>
        </Stack>
        <TimelineBar periods={model.periods} markers={model.markers} duration={duration} time={time} onSeek={seek} />
        <Slider size="small" min={0} max={Math.max(duration, 0.01)} step={0.02} value={time} onChange={(_, value) => seek(value as number)}
          aria-label="Log time" sx={{ mt: 0.5, py: 1 }} />
        <Typography variant="caption" color="text.secondary">Space plays and pauses. Arrow keys step 1 s (Shift for 5 s). Click the timeline or state strip to jump.</Typography>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 1.5, alignItems: "start" }}>
        <MechanismGraphs mechanisms={model.mechanisms} selected={selected} onSelect={selectMechanisms} time={time} />
        <FieldView pose={model.pose} time={time} field={field} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 1fr)", gap: 1.5, alignItems: "start" }}>
        <MechanismStatus mechanisms={selected} time={time} />
        <NumberTile title="Battery" value={battery} units="V" warn={battery !== undefined && battery < 8} />
      </Box>
      <StateStrip state={model.state} duration={duration} time={time} onSeek={seek} />
    </Stack>
  );
}
