import type { PointerEvent as ReactPointerEvent } from "react";
import { fieldColors } from "../fieldGeometry";

type FaceTargetProps = {
  /** Where the target sits relative to its robot, in SVG units. */
  dx: number;
  dy: number;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
};

/** The crosshair a leg keeps facing, with a dashed line back to its robot. Drawn inside the robot's group. */
export function FaceTarget({ dx, dy, onPointerDown }: FaceTargetProps) {
  return <g className="ab-face" transform={`translate(${dx} ${dy})`} onPointerDown={onPointerDown}>
    <line x1={-dx} y1={-dy} x2="0" y2="0" stroke={fieldColors.selected} strokeWidth="1.2" strokeDasharray="3 4" pointerEvents="none" />
    <circle r="9" fill="rgba(11, 18, 32, 0.6)" stroke={fieldColors.selected} strokeWidth="1.8" />
    <path d="M -13 0 H -4 M 4 0 H 13 M 0 -13 V -4 M 0 4 V 13" stroke={fieldColors.selected} strokeWidth="1.8" strokeLinecap="round" />
    <circle r="15" fill="transparent" />
    <title>The point this leg faces. Drag it; drop it on a named point to link them.</title>
  </g>;
}
