import { Chip } from "@mui/material";

type ReplayPillProps = {
  /** The replay robot's speed in m/s. */
  speed: number;
  /** The state requested at this moment. */
  state: string | null;
};

/** Over the field while replaying: how fast the robot goes and what it has asked for. */
export function ReplayPill({ speed, state }: ReplayPillProps) {
  return <Chip className="ab-replay-pill" size="small" color="primary" label={`Replay · ${speed.toFixed(1)} m/s${state ? ` · ${state}` : ""}`} />;
}
