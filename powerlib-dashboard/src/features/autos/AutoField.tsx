import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AutoRoutine, DriveStep } from "./autoModel";
import { normalizeHeading, orderedSubpoints, requestedStateAtSteps, round } from "./autoModel";
import { legProgress } from "./autoReplay";
import { FieldBackdrop } from "../field/FieldBackdrop";
import type { FieldLayout } from "../field/fieldLayouts";

const viewWidth = 1000;
const noStateColor = "#94a3b8";

type Drag =
  | { kind: "add"; clientX: number; clientY: number; x: number; y: number }
  | { kind: "move" | "rotate"; stepId: string; clientX: number; clientY: number; moved: boolean }
  | { kind: "subpoint"; stepId: string; subpointId: string; clientX: number; clientY: number; moved: boolean };

type AutoFieldProps = {
  auto: AutoRoutine | null;
  field: { length: number; width: number };
  layout: FieldLayout | null;
  robot: { width: number; length: number };
  stateColor: (state: string | null) => string;
  selectedStepId: string | null;
  pose?: { x: number; y: number; heading: number };
  onSelectStep: (stepId: string) => void;
  onAddPoint: (x: number, y: number) => void;
  onChangePoint: (stepId: string, patch: Partial<Pick<DriveStep, "x" | "y" | "heading">>) => void;
  /** Moves a subpoint along its leg; progress is 0 to 1. */
  onChangeSubpoint?: (stepId: string, subpointId: string, progress: number) => void;
};

/** Field view in the blue-origin frame: click to add a point, drag to move, drag the ring to aim. */
export function AutoField({ auto, field, layout, robot, stateColor, selectedStepId, pose, onSelectStep, onAddPoint, onChangePoint, onChangeSubpoint }: AutoFieldProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const scale = viewWidth / field.length;
  const viewHeight = field.width * scale;
  const px = (x: number) => x * scale;
  const py = (y: number) => viewHeight - y * scale;
  const robotLength = robot.length * scale;
  const robotWidth = robot.width * scale;
  const handleDistance = robotLength / 2 + 0.3 * scale;

  const toField = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x / scale, y: (viewHeight - point.y) / scale };
  };
  const clamp = (value: number, max: number) => round(Math.min(Math.max(value, 0), max));

  const steps = auto?.steps ?? [];
  const requested = auto ? requestedStateAtSteps(auto) : [];
  const drives = steps.flatMap((step, index) => step.type === "drive"
    ? [{ step, number: 0, color: stateColor(requested[index]) }] : []);
  drives.forEach((drive, index) => { drive.number = index + 1; });

  const begin = (event: ReactPointerEvent, drag: Drag) => {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = drag;
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind === "add") return;
    if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 3) return;
    drag.moved = true;
    const point = toField(event);
    if (drag.kind === "subpoint") {
      // Subpoints slide along the planned straight line from the previous point.
      const index = drives.findIndex(drive => drive.step.id === drag.stepId);
      if (point && index > 0) onChangeSubpoint?.(drag.stepId, drag.subpointId, round(legProgress(drives[index - 1].step, point, drives[index].step)));
      return;
    }
    const step = steps.find(candidate => candidate.id === drag.stepId);
    if (!point || step?.type !== "drive") return;
    if (drag.kind === "move") {
      onChangePoint(step.id, { x: clamp(point.x, field.length), y: clamp(point.y, field.width) });
    } else {
      const degrees = Math.atan2(point.y - step.y, point.x - step.x) * 180 / Math.PI;
      // Hold Shift to snap the heading to 15 degree increments.
      const snapped = event.shiftKey ? Math.round(degrees / 15) * 15 : Math.round(degrees);
      onChangePoint(step.id, { heading: normalizeHeading(snapped) });
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === "add" && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 4) {
      onAddPoint(clamp(drag.x, field.length), clamp(drag.y, field.width));
    }
  };

  return (
    <svg ref={svgRef} className="auto-field" viewBox={`-14 -14 ${viewWidth + 28} ${viewHeight + 28}`}
      role="img" aria-label="Auto path on the field" preserveAspectRatio="xMidYMid meet"
      onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; }}>
      <defs>
        <pattern id="auto-field-grid" width={scale} height={scale} patternUnits="userSpaceOnUse" y={viewHeight % scale}>
          <path d={`M ${scale} 0 H 0 V ${scale}`} fill="none" stroke="#2a3f4d" strokeWidth="1" />
        </pattern>
      </defs>
      <rect className="auto-field-surface" width={viewWidth} height={viewHeight} rx="5" fill="#101e29" stroke="#7993a5" strokeWidth="3"
        onPointerDown={event => {
          const point = toField(event);
          if (!auto || !point) return;
          begin(event, { kind: "add", clientX: event.clientX, clientY: event.clientY, x: point.x, y: point.y });
        }} />
      {layout ? <FieldBackdrop layout={layout} width={viewWidth} height={viewHeight} showTags /> : <>
        <rect width={viewWidth} height={viewHeight} fill="url(#auto-field-grid)" pointerEvents="none" />
        <rect width="16" height={viewHeight} fill="#307de0" opacity=".55" pointerEvents="none" />
        <rect x={viewWidth - 16} width="16" height={viewHeight} fill="#ec4d5d" opacity=".55" pointerEvents="none" />
        <path d={`M ${viewWidth / 2} 0 V ${viewHeight}`} stroke="#698191" strokeDasharray="10 9" pointerEvents="none" />
      </>}

      {drives.slice(1).map((drive, index) => {
        const from = drives[index].step;
        const angle = Math.atan2(py(drive.step.y) - py(from.y), px(drive.step.x) - px(from.x)) * 180 / Math.PI;
        const midX = (px(from.x) + px(drive.step.x)) / 2;
        const midY = (py(from.y) + py(drive.step.y)) / 2;
        const along = (progress: number) => ({ x: px(from.x + (drive.step.x - from.x) * progress), y: py(from.y + (drive.step.y - from.y) * progress) });
        // The path changes color where a subpoint requests a new state.
        const stops = [{ progress: 0, color: drive.color },
          ...orderedSubpoints(drive.step).map(subpoint => ({ progress: Math.min(1, Math.max(0, subpoint.progress || 0)), color: stateColor(subpoint.state) }))];
        const midColor = [...stops].reverse().find(stop => stop.progress <= 0.5)?.color ?? drive.color;
        return <g key={drive.step.id} pointerEvents="none" opacity=".9">
          {stops.map((stop, stopIndex) => {
            const start = along(stop.progress);
            const end = along(stops[stopIndex + 1]?.progress ?? 1);
            return <line key={stopIndex} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stop.color} strokeWidth="5" strokeLinecap="round" />;
          })}
          <path transform={`translate(${midX} ${midY}) rotate(${angle})`} d="M -8 -9 L 8 0 L -8 9 z" fill={midColor} />
        </g>;
      })}

      {drives.slice(1).flatMap((drive, index) => {
        const from = drives[index].step;
        return drive.step.subpoints.map(subpoint => {
          const progress = Math.min(1, Math.max(0, subpoint.progress || 0));
          const x = px(from.x + (drive.step.x - from.x) * progress);
          const y = py(from.y + (drive.step.y - from.y) * progress);
          return <g key={subpoint.id} transform={`translate(${x} ${y})`} style={{ cursor: onChangeSubpoint ? "grab" : undefined }}
            onPointerDown={event => {
              onSelectStep(drive.step.id);
              begin(event, { kind: "subpoint", stepId: drive.step.id, subpointId: subpoint.id, clientX: event.clientX, clientY: event.clientY, moved: false });
            }}>
            <rect x="-8" y="-8" width="16" height="16" transform="rotate(45)" fill={stateColor(subpoint.state)} stroke="#0b0f14" strokeWidth="2.5" />
            <title>{`${subpoint.state || "No state"} at ${Math.round(progress * 100)}% of the leg. Drag along the path to move it.`}</title>
          </g>;
        });
      })}

      {pose && <g transform={`translate(${px(pose.x)} ${py(pose.y)}) rotate(${-pose.heading})`} pointerEvents="none" opacity=".85">
        <rect x={-robotLength / 2} y={-robotWidth / 2} width={robotLength} height={robotWidth} rx="4" fill="#ffdc00" stroke="#fff" strokeWidth="2" />
        <path d={`M ${-robotLength / 6} ${-robotWidth / 4} L ${robotLength / 4} 0 L ${-robotLength / 6} ${robotWidth / 4}`} fill="none" stroke="#14212c" strokeWidth="4" />
      </g>}

      {drives.map(({ step, number, color }) => {
        const selected = step.id === selectedStepId;
        const radians = step.heading * Math.PI / 180;
        const handleX = px(step.x) + Math.cos(radians) * handleDistance;
        const handleY = py(step.y) - Math.sin(radians) * handleDistance;
        return <g key={step.id} className={`auto-point${selected ? " selected" : ""}`}>
          <g transform={`translate(${px(step.x)} ${py(step.y)}) rotate(${-step.heading})`}
            onPointerDown={event => { onSelectStep(step.id); begin(event, { kind: "move", stepId: step.id, clientX: event.clientX, clientY: event.clientY, moved: false }); }}>
            <rect x={-robotLength / 2} y={-robotWidth / 2} width={robotLength} height={robotWidth} rx="4"
              fill={color} fillOpacity={selected ? 0.45 : 0.22} stroke={selected ? "#facc15" : color} strokeWidth={selected ? 4 : 2.5} />
            <path d={`M ${-robotLength / 6} ${-robotWidth / 4} L ${robotLength / 4} 0 L ${-robotLength / 6} ${robotWidth / 4}`}
              fill="none" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <text x={px(step.x)} y={py(step.y) - robotWidth / 2 - 8} textAnchor="middle" className="auto-point-label">{number}</text>
          {selected && <>
            <line x1={px(step.x)} y1={py(step.y)} x2={handleX} y2={handleY} stroke="#facc15" strokeWidth="2" strokeDasharray="4 4" pointerEvents="none" />
            <circle className="auto-heading-handle" cx={handleX} cy={handleY} r="11"
              onPointerDown={event => begin(event, { kind: "rotate", stepId: step.id, clientX: event.clientX, clientY: event.clientY, moved: false })}>
              <title>Drag to aim. Hold Shift to snap to 15°.</title>
            </circle>
          </>}
        </g>;
      })}

      {!auto && <text x={viewWidth / 2} y={viewHeight / 2} textAnchor="middle" fill="#a8bbca" fontSize="22">Create or pick an auto to start</text>}
      {auto && drives.length === 0 && <text x={viewWidth / 2} y={viewHeight / 2} textAnchor="middle" fill="#a8bbca" fontSize="22" pointerEvents="none">
        Click the field to add the first point
      </text>}
      {drives.length > 0 && <text x={4} y={viewHeight + 12} fill={noStateColor} fontSize="11" pointerEvents="none">
        {`${layout ? `${layout.label} · ` : ""}Blue origin · ${field.length} m × ${field.width} m · straight-line drive-to-point`}
      </text>}
    </svg>
  );
}
