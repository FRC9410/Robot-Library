import { Tooltip, Typography } from "@mui/material";
import type { DrivetrainLimits } from "../autoLimits";
import { describeLimits } from "../autoLimits";
import { format } from "../stepText";

type DrivetrainCaptionProps = {
  /** Null when the robot project has no TunerConstants. */
  drivetrain: DrivetrainLimits | null;
};

/** What the robot's drivetrain can do, under a leg's motion limits; hover for where it comes from. */
export function DrivetrainCaption({ drivetrain }: DrivetrainCaptionProps) {
  if (!drivetrain) return <Typography variant="caption" color="text.secondary">
    No TunerConstants in the robot project, so these aren't checked against the drivetrain.
  </Typography>;
  return <Tooltip placement="left" title={<>
    <div>From TunerConstants: {format(drivetrain.freeSpeed, 2)} m/s free speed, about {format(drivetrain.topSpeed, 1)} m/s with a match battery.
      {drivetrain.maxAcceleration !== null && ` Acceleration from the drive motors' current limit, robot mass and wheel grip.`}</div>
    {drivetrain.notes.map(note => <div key={note} style={{ marginTop: 4 }}>{note}</div>)}
  </>}>
    <Typography variant="caption" color={drivetrain.notes.length ? "warning.main" : "text.secondary"} sx={{ cursor: "help", alignSelf: "flex-start" }}>
      This robot: {describeLimits(drivetrain)}{drivetrain.notes.length ? ` · ${drivetrain.notes.length} thing${drivetrain.notes.length === 1 ? "" : "s"} to check` : ""}
    </Typography>
  </Tooltip>;
}
