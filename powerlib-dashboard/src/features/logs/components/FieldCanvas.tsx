import type { ReactNode } from "react";
import { Box } from "@mui/material";

type FieldCanvasProps = {
  field: { length: number; width: number; flip: boolean };
  /** "vertical" stands the field up with the driver station side at the bottom, for a tall narrow column. */
  orientation?: "horizontal" | "vertical";
  /** Layers drawn in field coordinates: meters, x along the length from the blue wall, SVG y = field width - y. */
  children: ReactNode;
};

/** An empty field outline that keeps its proportions and fits the space it's given; its children are drawn on it. */
export function FieldCanvas({ field, orientation = "horizontal", children }: FieldCanvasProps) {
  const { length, width } = field;
  const vertical = orientation === "vertical";
  // Vertical turns the drawing so the blue wall is at the bottom.
  const turn = vertical ? `matrix(0 -1 1 0 0 ${length})` : "";
  const flip = field.flip ? `rotate(180 ${length / 2} ${width / 2})` : "";
  return (
    <Box component="svg" viewBox={vertical ? `-0.1 -0.1 ${width + 0.2} ${length + 0.2}` : `-0.1 -0.1 ${length + 0.2} ${width + 0.2}`}
      role="img" aria-label="Robot position on the field" sx={{ flex: 1, minHeight: 0, width: "100%", display: "block" }}>
      <g transform={`${turn} ${flip}`.trim() || undefined}>
        <rect x={0} y={0} width={length} height={width} rx={0.15} fill="rgba(255,255,255,0.02)" stroke="rgba(250,250,250,0.35)" strokeWidth={0.04} />
        <line x1={length / 2} x2={length / 2} y1={0} y2={width} stroke="rgba(250,250,250,0.2)" strokeWidth={0.03} />
        <rect x={0} y={width * 0.3} width={0.6} height={width * 0.4} fill="#3b82f6" opacity={0.25} />
        <rect x={length - 0.6} y={width * 0.3} width={0.6} height={width * 0.4} fill="#ef4444" opacity={0.25} />
        {children}
      </g>
    </Box>
  );
}
