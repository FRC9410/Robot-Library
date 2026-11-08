import { useDashboardSettings } from "../../dashboard/useDashboardSettings";
import { bumperRectangle } from "../robotFootprint";

export function RobotFootprint({ scale = 1, fill = "rgba(250,204,21,0.12)", stroke = "#facc15", strokeWidth = 2 }:
  { scale?: number; fill?: string; stroke?: string; strokeWidth?: number }) {
  const { bumper } = useDashboardSettings();
  const box = bumperRectangle(bumper, scale);
  return <rect data-robot-footprint="true" data-bumper-length-m={box.lengthMeters} data-bumper-width-m={box.widthMeters}
    x={box.x} y={box.y} width={box.width} height={box.height} rx={Math.min(box.width, box.height) * .06}
    fill={fill} stroke={stroke} strokeWidth={strokeWidth} pointerEvents="none" />;
}
