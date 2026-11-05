import { Chip, Tooltip } from "@mui/material";
import type { ActualRun } from "../autoActual";

type LastRunChipProps = {
  run: ActualRun;
  /** The run is being recorded right now. */
  recording: boolean;
  /** The run's path is drawn on the field. */
  shown: boolean;
  onToggle: () => void;
  onClear: () => void;
};

/** The robot's recorded run of this auto: recording now, or the last run, which can be shown, hidden or cleared. */
export function LastRunChip({ run, recording, shown, onToggle, onClear }: LastRunChipProps) {
  if (recording) return <Chip size="small" color="error" variant="outlined" label={`Recording · ${run.seconds.toFixed(1)} s`} />;
  return <Tooltip title={`The white line is where the robot went when it ran this auto at ${new Date(run.recordedAt).toLocaleTimeString()}. `
    + `Click to ${shown ? "hide" : "show"} it.`}>
    <Chip size="small" label={`Last run · ${run.seconds.toFixed(1)} s`} variant={shown ? "filled" : "outlined"} onClick={onToggle} onDelete={onClear} />
  </Tooltip>;
}
