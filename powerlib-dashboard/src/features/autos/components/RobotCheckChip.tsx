import { Chip, Tooltip } from "@mui/material";
import type { RobotCheck } from "../types";

/** Below this the robot and the replay agree well enough to say nothing. */
const noticeableSeconds = 0.05;

type RobotCheckChipProps = {
  check: RobotCheck;
  period: number;
};

/** How much longer the robot's drivetrain needs than the ideal replay, when it's enough to matter. */
export function RobotCheckChip({ check, period }: RobotCheckChipProps) {
  if (check.extraSeconds < noticeableSeconds) return null;
  return <Tooltip title={<>
    <div>This drivetrain ({check.summary}) needs about {check.extraSeconds.toFixed(2)} s more than the replay shows:
      {` ${check.robotDuration.toFixed(1)} s in all`}{check.robotDuration > period ? `, past the ${period} s period` : ""}. Orange marks where it falls behind.</div>
    {check.notes.map(note => <div key={note} style={{ marginTop: 4 }}>{note}</div>)}
  </>}>
    <Chip size="small" variant="outlined" color={check.robotDuration > period ? "error" : "warning"} label={`+${check.extraSeconds.toFixed(1)} s on the robot`} />
  </Tooltip>;
}
