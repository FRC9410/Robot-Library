import { Typography } from "@mui/material";
import { format } from "../stepText";
import type { LegReplayInfo } from "../types";

type LegReplaySummaryProps = {
  info: LegReplayInfo;
};

/** How long the replay takes on this leg (and on the real robot, when that differs), and how fast it goes. */
export function LegReplaySummary({ info }: LegReplaySummaryProps) {
  const extra = info.robotExtraSeconds ?? 0;
  return <Typography variant="body2" color={info.finished ? "text.secondary" : "error"}>
    {info.finished
      ? `Replay: ${format(info.seconds)} s${extra >= 0.05 ? ` (about ${format(info.seconds + extra)} s on the robot)` : ""}, `
        + `peaks at ${format(info.peakSpeed, 1)} m/s, leaves at ${format(info.exitSpeed, 1)} m/s`
      : "Replay: this leg never reaches its finish tolerances. Loosen them or slow down."}
  </Typography>;
}
