import type { FieldFrame } from "../fieldGeometry";

type FieldGridBackdropProps = {
  frame: FieldFrame;
};

/** The plain field when no field layout is picked: a 1 m grid, alliance walls and the center line. */
export function FieldGridBackdrop({ frame }: FieldGridBackdropProps) {
  const { scale, width, height } = frame;
  return <g pointerEvents="none">
    <defs>
      <pattern id="auto-field-grid" width={scale} height={scale} patternUnits="userSpaceOnUse" y={height % scale}>
        <path d={`M ${scale} 0 H 0 V ${scale}`} fill="none" stroke="#2a3f4d" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width={width} height={height} fill="url(#auto-field-grid)" />
    <rect width="16" height={height} fill="#307de0" opacity=".55" />
    <rect x={width - 16} width="16" height={height} fill="#ec4d5d" opacity=".55" />
    <path d={`M ${width / 2} 0 V ${height}`} stroke="#698191" strokeDasharray="10 9" />
  </g>;
}
