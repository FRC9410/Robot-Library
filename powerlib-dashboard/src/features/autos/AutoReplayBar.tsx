import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Chip, IconButton, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import type { Replay } from "./autoReplay";
import { stateAt } from "./autoReplay";

export function AutoReplayBar({ replay, time, playing, speed, stateColor, stepColor, activeStepId, period, onPeriod, onPlay, onPause, onStop, onSeek, onSpeed, onSelectStep }: {
  replay: Replay;
  time: number | null;
  playing: boolean;
  speed: number;
  stateColor: (state: string | null) => string;
  /** Color for a non-drive step, matching the step list (its state for state steps). */
  stepColor?: (stepId: string) => string | undefined;
  activeStepId: string | null;
  /** Autonomous period in seconds; the timeline always shows it so overruns are obvious. */
  period: number;
  onPeriod: (seconds: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSpeed: (speed: number) => void;
  onSelectStep: (stepId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scale = Math.max(replay.duration, period);
  const percent = (seconds: number) => `${seconds / scale * 100}%`;
  const empty = replay.frames.length === 0;
  /** A drive leg's colors over time, split where a subpoint changes the requested state (same as the field route). */
  const statePieces = (start: number, end: number) => {
    const cuts = [start, ...replay.stateChanges.map(change => change.t).filter(t => t > start && t < end), end];
    const stops = cuts.slice(0, -1).flatMap((from, index) => {
      const color = stateColor(stateAt(replay, from));
      const a = (from - start) / (end - start) * 100;
      const b = (cuts[index + 1] - start) / (end - start) * 100;
      return [`${color} ${a}%`, `${color} ${b}%`];
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  };

  const seekFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || empty) return;
    onSeek(Math.min(replay.duration, Math.max(0, (event.clientX - box.left) / box.width * scale)));
  };

  return <div className="ab-replay">
    {playing
      ? <IconButton size="small" aria-label="Pause replay" onClick={onPause}><PauseIcon /></IconButton>
      : <Tooltip title={empty ? "Add a drive point to replay this auto" : "Replay the ideal motion from point 1"}>
        <span><IconButton size="small" aria-label="Play replay" disabled={empty} color="primary" onClick={onPlay}><PlayArrowIcon /></IconButton></span>
      </Tooltip>}
    <IconButton size="small" aria-label="Stop replay and show the live robot" disabled={time === null} onClick={onStop}><StopIcon /></IconButton>
    <Typography variant="body2" className="ab-replay-time">
      {(time ?? 0).toFixed(1)} s
    </Typography>

    <div className="ab-timeline-wrap">
    {/* Total time sits above the end of the last step. */}
    {!empty && <span className={`ab-timeline-total${replay.duration > period ? " over" : ""}`}
      style={{ left: percent(replay.duration), transform: replay.duration / scale > 0.1 ? "translateX(-100%)" : undefined }}>{replay.duration.toFixed(1)} s</span>}
    <div ref={trackRef} className={`ab-timeline${empty ? " empty" : ""}`} role="slider" aria-label="Replay time"
      aria-valuemin={0} aria-valuemax={replay.duration} aria-valuenow={time ?? 0}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); seekFromPointer(event); }}
      onPointerMove={event => { if (event.buttons & 1) seekFromPointer(event); }}>
      {replay.segments.map(segment => <div key={`${segment.stepId}-${segment.start}`}
        className={`ab-timeline-block ${segment.type}${segment.stepId === activeStepId ? " active" : ""}`}
        title={`Step ${segment.stepIndex + 1}: ${(segment.end - segment.start).toFixed(2)} s`}
        style={{ left: percent(segment.start), width: percent(segment.end - segment.start),
          background: segment.type === "drive" ? statePieces(segment.start, segment.end)
            : segment.type === "waitForState" && stepColor?.(segment.stepId) ? `repeating-linear-gradient(135deg, ${stepColor(segment.stepId)} 0 4px, #3f3f46 4px 8px)`
            : stepColor?.(segment.stepId) }}
        onDoubleClick={() => segment.stepId !== "clear" && onSelectStep(segment.stepId)} />)}
      {replay.stateChanges.filter(change => change.subpointId).map(change => <div key={change.subpointId}
        className="ab-timeline-tick" style={{ left: percent(change.t), background: stateColor(change.state) }}
        title={`${change.state} requested at ${change.t.toFixed(2)} s`} />)}
      <div className="ab-timeline-limit" style={{ left: percent(period) }} title={`${period} s autonomous period`} />
      {time !== null && <div className="ab-timeline-head" style={{ left: percent(time) }} />}
    </div>
    </div>

    {replay.duration > period && <Chip size="small" color="error" variant="outlined" label={`Over ${period} s`} />}
    <PeriodLabel period={period} onChange={onPeriod} />
    {replay.unfinishedStepIds.length > 0 && <Chip size="small" color="warning" variant="outlined" label={`${replay.unfinishedStepIds.length} leg${replay.unfinishedStepIds.length === 1 ? "" : "s"} never finish`} />}
    <TextField select size="small" value={speed} onChange={event => onSpeed(Number(event.target.value))} aria-label="Replay speed"
      sx={{ width: 76 }} slotProps={{ select: { sx: { py: 0.5 } } }}>
      {[0.25, 0.5, 1, 2].map(value => <MenuItem key={value} value={value}>{value}×</MenuItem>)}
    </TextField>
  </div>;
}

/** The autonomous period, shown quietly at the end of the timeline; click it to change it. */
function PeriodLabel({ period, onChange }: { period: number; onChange: (seconds: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const value = Number(draft);
    if (draft !== null && Number.isFinite(value) && value >= 1 && value <= 60) onChange(Math.round(value * 10) / 10);
    setDraft(null);
  };
  if (draft !== null) {
    return <input className="ab-period-input" autoFocus value={draft} aria-label="Autonomous period in seconds"
      onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === "Enter") commit(); if (event.key === "Escape") setDraft(null); }} />;
  }
  return <Tooltip title="Autonomous period length. Click to change.">
    <button type="button" className="ab-period" onClick={() => setDraft(String(period))}>{period} s</button>
  </Tooltip>;
}
