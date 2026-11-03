import type { PoseHeatmap } from "../logModel";

type FieldHeatmapProps = {
  heatmap: PoseHeatmap;
  fieldWidth: number;
};

/** Green for a little time in a cell, through yellow, to red for the most. Square-root scaled so short visits still show. */
function heatColor(share: number) {
  return `hsl(${Math.round(120 * (1 - share))}, 85%, 50%)`;
}

/** Where the robot has been, colored by time spent there. Drawn inside a FieldCanvas. */
export function FieldHeatmap({ heatmap, fieldWidth }: FieldHeatmapProps) {
  const { cell, columns, counts, max } = heatmap;
  if (max === 0) return null;
  return (
    <g>
      {counts.map((count, slot) => {
        if (count === 0) return null;
        const column = slot % columns;
        const row = Math.floor(slot / columns);
        const share = Math.sqrt(count / max);
        return (
          <rect key={slot} x={column * cell} y={fieldWidth - (row + 1) * cell} width={cell} height={cell}
            fill={heatColor(share)} opacity={0.55 + 0.35 * share} />
        );
      })}
    </g>
  );
}
