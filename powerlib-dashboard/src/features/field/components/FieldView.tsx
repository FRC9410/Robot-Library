import { useId } from "react";
import type { KeyboardEventHandler, MouseEventHandler, PointerEventHandler, ReactNode } from "react";
import type { FieldLayout } from "../fieldLayouts";
import { FieldBackdrop } from "./FieldBackdrop";

type FieldViewProps = {
  dimensions: { length: number; width: number };
  layout: FieldLayout | null;
  pose?: { x: number; y: number; heading: number };
  flip?: boolean;
  labels?: boolean;
  /** Extra SVG margin for editor handles at the field edges. */
  padding?: number;
  emptyMessage?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<SVGSVGElement>;
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerUp?: PointerEventHandler<SVGSVGElement>;
  onPointerCancel?: PointerEventHandler<SVGSVGElement>;
  onLostPointerCapture?: PointerEventHandler<SVGSVGElement>;
  onKeyDown?: KeyboardEventHandler<SVGSVGElement>;
};

/** All views use blue-origin meters; flipping changes only the display. */
export function FieldView({ dimensions, layout, pose, flip = false, labels = false, padding = 12, emptyMessage, children, onClick, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onKeyDown }: FieldViewProps) {
  const gridId = `field-grid-${useId().replaceAll(":", "")}`;
  const field = layout ?? dimensions;
  const height = 480;
  const width = height * field.length / field.width;
  const outOfBounds = pose && (pose.x < 0 || pose.x > field.length || pose.y < 0 || pose.y > field.width);
  return <svg viewBox={`${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`} role="img" aria-label="Field and robot position"
    tabIndex={onKeyDown ? -1 : undefined}
    onClick={onClick} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
    onLostPointerCapture={onLostPointerCapture} onKeyDown={onKeyDown}
    data-field-layout={layout?.id ?? "none"} data-field-length={field.length} data-field-width={field.width}
    preserveAspectRatio="xMidYMid meet">
    <defs><pattern id={gridId} width={width / 16} height={height / 8} patternUnits="userSpaceOnUse">
      <path d={`M ${width / 16} 0 H 0 V ${height / 8}`} fill="none" stroke="#355060" strokeWidth="1" />
    </pattern></defs>
    <g transform={flip ? `translate(${width} ${height}) rotate(180)` : undefined}>
      <rect width={width} height={height} rx="5" fill="#101e29" stroke="#7993a5" strokeWidth="3" />
      {layout ? <FieldBackdrop layout={layout} width={width} height={height} labels={labels} /> : <>
        <rect width={width} height={height} fill={`url(#${gridId})`} />
        <rect width="16" height={height} fill="#307de0" opacity=".55" />
        <rect x={width - 16} width="16" height={height} fill="#ec4d5d" opacity=".55" />
        <path d={`M ${width / 2} 0 V ${height}`} stroke="#698191" strokeDasharray="10 9" />
      </>}
      {pose && !outOfBounds && <g data-robot-pose="true"
        transform={`translate(${pose.x / field.length * width} ${height - pose.y / field.width * height}) rotate(${-pose.heading})`}>
        <rect x="-15" y="-15" width="30" height="30" rx="4" fill="#ffdc00" stroke="#fff" strokeWidth="2" />
        <path d="M -5 -7 L 9 0 L -5 7" fill="none" stroke="#14212c" strokeWidth="4" />
      </g>}
      {children}
    </g>
    {(outOfBounds || (!pose && emptyMessage)) && <text x={width / 2} y={height / 2} textAnchor="middle" fill="#a8bbca" fontSize="18"
      stroke="#101e29" strokeWidth="4" paintOrder="stroke">
      {outOfBounds ? "Pose outside configured field" : emptyMessage}
    </text>}
  </svg>;
}
