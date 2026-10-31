import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Chip, IconButton, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import type { Replay } from "./autoReplay";

/** FRC autonomous period; the timeline always shows it so overruns are obvious. */
export const autoPeriodSeconds = 15;

export function AutoReplayBar({ replay, time, playing, speed, stateColor, activeStepId, onPlay, onPause, onStop, onSeek, onSpeed, onSelectStep }: {
  replay: Replay;
  time: number | null;
  playing: boolean;
  speed: number;
  stateColor: (state: string | null) => string;
  activeStepId: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSpeed: (speed: number) => void;
  onSelectStep: (stepId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scale = Math.max(replay.duration, autoPeriodSeconds);
  const percent = (seconds: number) => `${seconds / scale * 100}%`;
  const empty = replay.frames.length === 0;

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
      {(time ?? 0).toFixed(1)} / {replay.duration.toFixed(1)} s
    </Typography>

    <div ref={trackRef} className={`ab-timeline${empty ? " empty" : ""}`} role="slider" aria-label="Replay time"
      aria-valuemin={0} aria-valuemax={replay.duration} aria-valuenow={time ?? 0}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); seekFromPointer(event); }}
      onPointerMove={event => { if (event.buttons & 1) seekFromPointer(event); }}>
      {replay.segments.map(segment => <div key={`${segment.stepId}-${segment.start}`}
        className={`ab-timeline-block ${segment.type}${segment.stepId === activeStepId ? " active" : ""}`}
        title={`Step ${segment.stepIndex + 1}: ${(segment.end - segment.start).toFixed(2)} s`}
        style={{ left: percent(segment.start), width: percent(segment.end - segment.start),
          background: segment.type === "drive" ? stateColor(segment.state) : undefined }}
        onDoubleClick={() => segment.stepId !== "clear" && onSelectStep(segment.stepId)} />)}
      {replay.stateChanges.filter(change => change.subpointId).map(change => <div key={change.subpointId}
        className="ab-timeline-tick" style={{ left: percent(change.t), background: stateColor(change.state) }}
        title={`${change.state} requested at ${change.t.toFixed(2)} s`} />)}
      <div className="ab-timeline-limit" style={{ left: percent(autoPeriodSeconds) }} title="15 s autonomous period" />
      {time !== null && <div className="ab-timeline-head" style={{ left: percent(time) }} />}
    </div>

    {replay.duration > autoPeriodSeconds && <Chip size="small" color="error" variant="outlined" label="Over 15 s" />}
    {replay.unfinishedStepIds.length > 0 && <Chip size="small" color="warning" variant="outlined" label={`${replay.unfinishedStepIds.length} leg${replay.unfinishedStepIds.length === 1 ? "" : "s"} never finish`} />}
    <TextField select size="small" value={speed} onChange={event => onSpeed(Number(event.target.value))} aria-label="Replay speed"
      sx={{ width: 76 }} slotProps={{ select: { sx: { py: 0.5 } } }}>
      {[0.25, 0.5, 1, 2].map(value => <MenuItem key={value} value={value}>{value}×</MenuItem>)}
    </TextField>
  </div>;
}
