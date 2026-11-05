import type { PointerEvent as ReactPointerEvent } from "react";
import { fieldColors } from "../fieldGeometry";

type HeadingHandleProps = {
  /** Where the arm starts (the robot's front) and where the handle sits, in SVG units along +X. */
  from: number;
  to: number;
  stroke: string;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
};

/** The dot in front of a waypoint robot; drag it to aim the robot. */
export function HeadingHandle({ from, to, stroke, onPointerDown }: HeadingHandleProps) {
  return <g className="ab-node-handle" onPointerDown={onPointerDown}>
    <line x1={from} y1="0" x2={to} y2="0" stroke={stroke} strokeWidth="1.4" />
    <circle cx={to} cy="0" r="5.5" fill="#f8fafc" stroke={fieldColors.ink} strokeWidth="1.5" />
    <circle cx={to} cy="0" r="12" fill="transparent" />
    <title>Drag to aim. Snaps to 45° and nearby headings; Shift for 15° steps, Ctrl to turn freely.</title>
  </g>;
}
