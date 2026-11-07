import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { poseHeatmap, valueAt } from "../logModel";
import type { LogPeriod, Series } from "../logModel";
import type { SwerveModules } from "../swerveModel";
import type { Pose } from "../wpilog";
import { FieldCanvas } from "./FieldCanvas";
import { FieldHeatmap } from "./FieldHeatmap";
import { LogCard } from "./LogCard";
import { RobotPose } from "./RobotPose";
import { SwerveModulesView } from "./SwerveModulesView";

type FieldViewProps = {
  pose?: Series<Pose>;
  swerve?: SwerveModules;
  periods: LogPeriod[];
  time: number;
  field: { length: number; width: number; flip: boolean };
  /** "vertical" stands the field up with the driver station side at the bottom, for a tall narrow column. */
  orientation?: "horizontal" | "vertical";
  sx?: SxProps<Theme>;
};

type FieldMode = "position" | "heatmap" | "swerve";
const toggleSx = { py: 0, px: 1, textTransform: "none", fontSize: 12 } as const;

/**
 * The field card: the robot now with its last 3 s of path, a heat map of where it has spent the match (while enabled)
 * up to the playhead, or its swerve wheels close up. On the field, each wheel has an arrow when the log has module data.
 */
export function FieldView({ pose, swerve, periods, time, field, orientation = "horizontal", sx }: FieldViewProps) {
  const [mode, setMode] = useState<FieldMode>("position");
  const heatmap = useMemo(() => (pose && mode === "heatmap" ? poseHeatmap(pose, periods, field.length, field.width, 0.3, time) : null),
    [pose, periods, field.length, field.width, mode, time]);
  if (!pose && !swerve) {
    return (
      <LogCard title="Field" sx={sx}>
        <Typography variant="body2" color="text.secondary">No robot pose in this log.</Typography>
      </LogCard>
    );
  }
  const current = valueAt(pose, time);
  const toggle = (
    <ToggleButtonGroup exclusive size="small" color="primary" value={mode} aria-label="What the field shows"
      onChange={(_, next: FieldMode | null) => { if (next) setMode(next); }}>
      <ToggleButton value="position" sx={toggleSx}>Position</ToggleButton>
      <ToggleButton value="heatmap" sx={toggleSx}>Heat map</ToggleButton>
      <ToggleButton value="swerve" sx={toggleSx}>Swerve</ToggleButton>
    </ToggleButtonGroup>
  );
  const position = current ? `x ${current.x.toFixed(2)} m · y ${current.y.toFixed(2)} m · ${((current.heading * 180) / Math.PI).toFixed(0)}°` : "";
  const caption = mode === "swerve" ? (swerve ? "Dashed = told to face" : "")
    : [mode === "position" ? "Last 3 s of path" : "", position].filter(Boolean).join(" · ");
  return (
    <LogCard title="Field" action={toggle} sx={sx}>
      {mode === "swerve" && <SwerveModulesView swerve={swerve} time={time} />}
      {mode !== "swerve" && (pose
        ? (
          <FieldCanvas field={field} orientation={orientation}>
            {heatmap && <FieldHeatmap heatmap={heatmap} fieldWidth={field.width} />}
            <RobotPose pose={pose} time={time} fieldWidth={field.width} trailSeconds={mode === "position" ? 3 : 0} modules={swerve?.states} />
          </FieldCanvas>
        )
        : <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>No robot pose in this log.</Typography>)}
      {caption && <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>{caption}</Typography>}
    </LogCard>
  );
}
