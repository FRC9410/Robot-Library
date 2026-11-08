import { legEndHeading, type DriveStep } from "../autoModel";
import { RobotFootprint } from "../../field/components/RobotFootprint";
import { bumperRectangle } from "../../field/robotFootprint";
import { useDashboardSettings } from "../../dashboard/useDashboardSettings";

type Point = { x: number; y: number };
type Props = { points: DriveStep[]; pixel: (point: Point) => Point; scale: number; flip: boolean; selectedIds: string[];
  selectedId: string | null; disabled: boolean; onSelect: (id: string) => void };

/** State requests belong to the incoming leg of their destination point. */
export function AutoSubpointMarkers({ points, pixel, scale, flip, selectedIds, selectedId, disabled, onSelect }: Props) {
  const { bumper } = useDashboardSettings();
  const box = bumperRectangle(bumper, scale);
  const labelOffset = Math.hypot(box.width, box.height) / 2 + 10;
  return <>{points.flatMap((step, pointIndex) => {
    const previous = points[pointIndex - 1], end = pixel(step), start = previous ? pixel(previous) : end;
    const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
    const selected = step.id === selectedId || selectedIds.includes(step.id);
    return step.subpoints.flatMap((subpoint, index) => {
      if (!Number.isFinite(subpoint.progress) || subpoint.progress < 0 || subpoint.progress > 1) return [];
      const anchor = { x: start.x + dx * subpoint.progress, y: start.y + dy * subpoint.progress };
      const position = { x: (previous?.x ?? step.x) + (step.x - (previous?.x ?? step.x)) * subpoint.progress,
        y: (previous?.y ?? step.y) + (step.y - (previous?.y ?? step.y)) * subpoint.progress };
      const heading = step.turn.mode === "face" ? Math.atan2(step.turn.y - position.y, step.turn.x - position.x) * 180 / Math.PI
        : step.turn.mode === "later" && subpoint.progress < step.turn.startProgress ? legEndHeading(previous ?? step) : step.heading;
      // Shared positions keep their physical footprint; only their labels are stacked.
      const overlapping = length < .001 ? index : step.subpoints.slice(0, index).filter(item => item.progress === subpoint.progress).length;
      const percent = Math.round(subpoint.progress * 1000) / 10;
      const label = `${percent}% · ${subpoint.state || "Choose state"}`;
      const description = `Subpoint ${index + 1}: ${label}, drive point ${pointIndex + 1}${previous ? "" : ". First leg position depends on the robot's starting pose"}`;
      return [<g key={subpoint.id} data-auto-subpoint={subpoint.id} data-subpoint-step={step.id} data-subpoint-progress={subpoint.progress}
        role="button" tabIndex={disabled ? -1 : 0} aria-label={description} aria-disabled={disabled}
        style={{ cursor: disabled ? "default" : "pointer" }}
        onPointerDown={event => { event.stopPropagation(); event.preventDefault(); }}
        onClick={event => { event.stopPropagation(); if (!disabled) onSelect(step.id); }}
        onKeyDown={event => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); onSelect(step.id); } }}>
        <title>{description}</title>
        <g transform={`translate(${anchor.x} ${anchor.y})`}>
          <g data-subpoint-bumper="true" transform={`rotate(${-heading})`}>
            <RobotFootprint scale={scale} stroke="#c084fc" fill={selected ? "rgba(192,132,252,0.08)" : "none"} />
            <RobotFootprint scale={scale} stroke="transparent" fill="none" strokeWidth={10} pointerEvents="stroke" />
          </g>
          {selected && <g transform={flip ? "rotate(180)" : undefined} pointerEvents="none">
            <text data-subpoint-label="true" x="0" y={-labelOffset - overlapping * 14} textAnchor="middle" fill="#e9d5ff" stroke="#0d1922" strokeWidth="3.5" strokeLinejoin="round"
              paintOrder="stroke" fontSize="10" fontWeight="600">{label}</text>
          </g>}
        </g>
      </g>];
    });
  })}</>;
}
