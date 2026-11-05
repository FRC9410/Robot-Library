import { IconButton, Typography } from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { TooltipIconButton } from "./TooltipIconButton";

type ReplayControlsProps = {
  /** Seconds into the replay; null when stopped. */
  time: number | null;
  playing: boolean;
  /** The auto has no drive points to replay. */
  empty: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
};

/** Play, pause and stop for the replay, and where it is. */
export function ReplayControls({ time, playing, empty, onPlay, onPause, onStop }: ReplayControlsProps) {
  return <>
    {playing
      ? <IconButton size="small" aria-label="Pause replay" onClick={onPause}><PauseIcon /></IconButton>
      : <TooltipIconButton title={empty ? "Add a drive point to replay this auto" : "Replay the ideal motion from point 1"} label="Play replay"
        disabled={empty} color="primary" onClick={onPlay}><PlayArrowIcon /></TooltipIconButton>}
    <IconButton size="small" aria-label="Stop replay and show the live robot" disabled={time === null} onClick={onStop}><StopIcon /></IconButton>
    <Typography variant="body2" className="ab-replay-time">{(time ?? 0).toFixed(1)} s</Typography>
  </>;
}
