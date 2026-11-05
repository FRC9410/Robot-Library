import { useMemo } from "react";
import type { DriveStep } from "../autoModel";
import type { Replay } from "../autoReplay";
import type { FieldFrame } from "../fieldGeometry";
import { fieldColors, routeDrawing } from "../fieldGeometry";

type PlannedRouteProps = {
  drives: DriveStep[];
  replay?: Replay;
  frame: FieldFrame;
  stateColor: (state: string | null) => string;
};

/**
 * The route the replay drives, colored by the state requested, with dots every tenth of a second
 * and an arrow per leg. Faint straight lines to each target sit underneath.
 */
export function PlannedRoute({ drives, replay, frame, stateColor }: PlannedRouteProps) {
  const { px, py } = frame;
  // The frame object is rebuilt each render; its size is what the drawing depends on.
  const route = useMemo(() => routeDrawing(replay, stateColor, frame), [replay, stateColor, frame.scale, frame.height]);
  return <g pointerEvents="none">
    {drives.slice(1).map((drive, index) => <line key={drive.id} x1={px(drives[index].x)} y1={py(drives[index].y)}
      x2={px(drive.x)} y2={py(drive.y)} stroke={fieldColors.node} strokeOpacity=".22" strokeWidth="1.2" strokeDasharray="4 5" />)}
    {route.runs.map((run, index) => <polyline key={index} points={run.points} fill="none" stroke={run.color} strokeWidth="2.6"
      strokeLinecap="round" strokeLinejoin="round" />)}
    {route.dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r="2.6" fill={dot.color} stroke={fieldColors.ink} strokeWidth="1" />)}
    {route.arrows.map((arrow, index) => <path key={index} transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
      d="M -5 -5 L 3 0 L -5 5" fill="none" stroke={arrow.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />)}
  </g>;
}
