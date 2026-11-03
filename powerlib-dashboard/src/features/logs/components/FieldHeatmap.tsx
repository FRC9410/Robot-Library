import type { PoseHeatmap } from "../logModel";

type FieldHeatmapProps = {
  heatmap: PoseHeatmap;
  fieldWidth: number;
};

/** Cells the robot spent more time in are brighter. Drawn inside a FieldCanvas; square-root scaled so short visits still show. */
export function FieldHeatmap({ heatmap, fieldWidth }: FieldHeatmapProps) {
  const { cell, columns, counts, max } = heatmap;
  if (max === 0) return null;
  return (
    <g>
      {counts.map((count, slot) => {
        if (count === 0) return null;
        const column = slot % columns;
        const row = Math.floor(slot / columns);
        return (
          <rect key={slot} x={column * cell} y={fieldWidth - (row + 1) * cell} width={cell} height={cell}
            fill="#f97316" opacity={0.15 + 0.8 * Math.sqrt(count / max)} />
        );
      })}
    </g>
  );
}
