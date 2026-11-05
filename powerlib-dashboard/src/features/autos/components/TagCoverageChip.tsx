import { Chip, Tooltip } from "@mui/material";
import type { RouteVision } from "../autoVision";

type TagCoverageChipProps = {
  vision: RouteVision;
};

/** How long the robot goes without an AprilTag to place itself with. */
export function TagCoverageChip({ vision }: TagCoverageChipProps) {
  const longest = vision.longestBlind;
  return <Tooltip title={longest
    ? `The robot has no AprilTag to place itself with for ${vision.blindSeconds.toFixed(1)} s in all, the longest from ${longest.start.toFixed(1)} s `
      + `to ${longest.end.toFixed(1)} s. It coasts on the gyro and wheels there.`
    : "Every moment of this auto has a tag the robot could place itself with."}>
    <Chip size="small" variant="outlined" color={longest && longest.end - longest.start >= 1 ? "warning" : "success"}
      label={vision.blindSeconds > 0 ? `${vision.blindSeconds.toFixed(1)} s without tags` : "Tags throughout"} />
  </Tooltip>;
}
