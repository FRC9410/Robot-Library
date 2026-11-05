import type { PointerEvent as ReactPointerEvent } from "react";
import type { SubpointMark } from "../fieldGeometry";
import { fieldColors } from "../fieldGeometry";

type SubpointMarkerProps = {
  mark: SubpointMark;
  color: string;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
};

/** A diamond where a state is requested partway along a leg; drag it along the path to move it. */
export function SubpointMarker({ mark, color, onPointerDown }: SubpointMarkerProps) {
  return <g className="ab-subpoint" transform={`translate(${mark.x} ${mark.y})`} onPointerDown={onPointerDown}>
    <rect x="-5.5" y="-5.5" width="11" height="11" transform="rotate(45)" fill={color} stroke={fieldColors.ink} strokeWidth="2" />
    <title>{`${mark.state ?? "No state"} requested here. Drag along the path to move it.`}</title>
  </g>;
}
