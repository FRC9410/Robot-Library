import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { poseHeatmap, valueAt } from "../logModel";
import type { LogPeriod, Series } from "../logModel";
import type { Pose } from "../wpilog";
import { FieldCanvas } from "./FieldCanvas";
import { FieldHeatmap } from "./FieldHeatmap";
import { LogCard } from "./LogCard";
import { RobotPose } from "./RobotPose";

type FieldViewProps = {
  pose?: Series<Pose>;
  periods: LogPeriod[];
  time: number;
  field: { length: number; width: number; flip: boolean };
  /** "vertical" stands the field up with the driver station side at the bottom, for a tall narrow column. */
  orientation?: "horizontal" | "vertical";
  sx?: SxProps<Theme>;
};

type FieldMode = "position" | "heatmap";

/** The field card: the robot now with its last 3 s of path, or a heat map of where it spent the match while enabled. */
export function FieldView({ pose, periods, time, field, orientation = "horizontal", sx }: FieldViewProps) {
  const [mode, setMode] = useState<FieldMode>("position");
  const heatmap = useMemo(() => (pose && mode === "heatmap" ? poseHeatmap(pose, periods, field.length, field.width) : null),
    [pose, periods, field.length, field.width, mode]);
  if (!pose) {
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
      <ToggleButton value="position" sx={{ py: 0, px: 1, textTransform: "none", fontSize: 12 }}>Position</ToggleButton>
      <ToggleButton value="heatmap" sx={{ py: 0, px: 1, textTransform: "none", fontSize: 12 }}>Heat map</ToggleButton>
    </ToggleButtonGroup>
  );
  return (
    <LogCard title="Field" action={toggle} sx={sx}>
      <FieldCanvas field={field} orientation={orientation}>
        {heatmap && <FieldHeatmap heatmap={heatmap} fieldWidth={field.width} />}
        <RobotPose pose={pose} time={time} fieldWidth={field.width} trailSeconds={mode === "position" ? 3 : 0} />
      </FieldCanvas>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
        {mode === "heatmap" ? "Brighter = more time there while enabled" : "Last 3 s of path"}
        {current && ` · x ${current.x.toFixed(2)} m · y ${current.y.toFixed(2)} m · ${((current.heading * 180) / Math.PI).toFixed(0)}°`}
      </Typography>
    </LogCard>
  );
}
