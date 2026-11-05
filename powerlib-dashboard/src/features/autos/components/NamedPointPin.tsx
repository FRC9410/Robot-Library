import type { NamedPoint } from "../autoModel";
import type { FieldFrame } from "../fieldGeometry";
import { fieldColors } from "../fieldGeometry";

type NamedPointPinProps = {
  point: NamedPoint;
  frame: FieldFrame;
  onAdd: (pointId: string) => void;
};

/** A named point this auto doesn't use; click it to add a drive step there, linked to the point. */
export function NamedPointPin({ point, frame, onAdd }: NamedPointPinProps) {
  return <g className="ab-pin" transform={`translate(${frame.px(point.x)} ${frame.py(point.y)})`}
    onPointerDown={event => { event.stopPropagation(); if (event.button === 0) onAdd(point.id); }}>
    <circle r="6" fill={fieldColors.ink} stroke={fieldColors.namedPoint} strokeWidth="2" />
    <circle r="2" fill={fieldColors.namedPoint} />
    <text className="ab-pin-label" y="-10" textAnchor="middle">{point.name}</text>
    <title>{`${point.name}: click to add a drive step here, linked to this point`}</title>
  </g>;
}
