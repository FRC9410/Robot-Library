import { useMemo } from "react";
import { Box, Button, Chip, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { matchClockAt, valueAt } from "../logModel";
import type { LogPeriod, Series } from "../logModel";
import { formatClock, formatMatchClock, stateColor, stateOrder } from "../logUtils";
import { PhaseToggle } from "./PhaseToggle";
import { Timeline } from "./Timeline";

type PlayBarProps = {
  time: number;
  duration: number;
  playing: boolean;
  speed: number;
  periods: LogPeriod[];
  state?: Series<string>;
  matchTime?: Series<number>;
  fmsAttached?: Series<boolean>;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
  onSeek: (time: number) => void;
};

/** Playback on one row: play and speed, the time with its match period and robot state, the timeline, and the period switch. */
export function PlayBar({ time, duration, playing, speed, periods, state, matchTime, fmsAttached, onTogglePlay, onCycleSpeed, onSeek }: PlayBarProps) {
  const order = useMemo(() => stateOrder(state), [state]);
  const period = periods.find(item => time >= item.start && time < item.end);
  const currentState = valueAt(state, time);
  const matchClock = matchClockAt(matchTime, time);
  const onField = valueAt(fmsAttached, time) === true;
  return (
    <Paper variant="outlined" sx={{ px: 1, py: 0.75, borderRadius: 2, display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
      <Tooltip title="Play or pause (Space). Arrow keys step 1 s, Shift for 5 s.">
        <IconButton size="small" color="primary" onClick={onTogglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
      </Tooltip>
      <Button size="small" variant="outlined" sx={{ minWidth: 44, px: 0.5 }} onClick={onCycleSpeed} aria-label="Playback speed">{speed}x</Button>
      <Box sx={{ minWidth: 170, flexShrink: 0, whiteSpace: "nowrap" }}>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
          {formatClock(time)} · {period ? period.label : "Disabled"}
          {matchClock !== undefined && (
            <Box component="span" title="Match time left, from the Driver Station" sx={{ color: "primary.main", ml: 0.75 }}>{formatMatchClock(matchClock)} left</Box>
          )}
          {onField && (
            <Chip component="span" size="small" variant="outlined" color="primary" label="FMS" title="Connected to a field (FMS): a real match"
              sx={{ ml: 0.75, height: 18, fontSize: 10, fontWeight: 800, verticalAlign: "text-bottom" }} />
          )}
        </Typography>
        {state && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", lineHeight: 1.2 }}>
            <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: 0.5, mr: 0.5,
              bgcolor: stateColor(currentState ?? "", order) }} />
            {currentState || "No state"}
          </Typography>
        )}
      </Box>
      <Timeline periods={periods} state={state} stateOrder={order} duration={duration} time={time} onSeek={onSeek} />
      <PhaseToggle periods={periods} current={period} onSeek={onSeek} />
    </Paper>
  );
}
