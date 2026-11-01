import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ActualPoint } from "./autoActual";
import type { AutoRoutine, DriveStep, NamedPoint } from "./autoModel";
import { legEndHeading, normalizeHeading, round } from "./autoModel";
import type { Replay } from "./autoReplay";
import { frameAt, legProgress, loopPeriodSeconds } from "./autoReplay";
import { snapHeading, snapPosition } from "./autoSnap";
import type { AxisTarget, SnapGuide } from "./autoSnap";
import { FieldBackdrop } from "../field/FieldBackdrop";
import type { FieldLayout } from "../field/fieldLayouts";

const viewWidth = 1000;
const noStateColor = "#94a3b8";
const nodeColor = "#e2e8f0";
const selectedColor = "#facc15";
const guideColor = "#22d3ee";
/** Snap distance in screen pixels, and heading snap in degrees. */
const snapPixels = 9;
const headingSnapDegrees = 7;

type Point = { x: number; y: number };
type SelectMode = "replace" | "toggle" | "add";

type Drag =
  | { kind: "surface"; clientX: number; clientY: number; start: Point; additive: boolean; moved: boolean }
  | { kind: "move"; stepId: string; ids: string[]; origins: Map<string, Point>; grab: Point; clientX: number; clientY: number; moved: boolean; reselect: boolean }
  | { kind: "rotate"; stepId: string; clientX: number; clientY: number; moved: boolean }
  | { kind: "subpoint"; stepId: string; subpointId: string; clientX: number; clientY: number; moved: boolean }
  | { kind: "face"; stepId: string; clientX: number; clientY: number; moved: boolean };

type Overlay = { guides: SnapGuide[]; marquee?: { a: Point; b: Point }; note?: { at: Point; text: string }; hint?: string };

type AutoFieldProps = {
  auto: AutoRoutine | null;
  field: { length: number; width: number };
  layout: FieldLayout | null;
  robot: { width: number; length: number };
  stateColor: (state: string | null) => string;
  selectedStepIds: string[];
  /** The ideal motion, drawn as the robot's route. */
  replay?: Replay;
  /** The live or replay robot; `travel` is its direction of motion in degrees, for the wheels. */
  pose?: { x: number; y: number; heading: number; travel?: number };
  onSelectSteps: (stepIds: string[], mode: SelectMode) => void;
  onAddPoint: (x: number, y: number) => void;
  onMovePoints: (moves: { stepId: string; x: number; y: number }[]) => void;
  onChangeHeading: (stepId: string, heading: number) => void;
  /** Moves a subpoint along its leg; progress is 0 to 1. */
  onChangeSubpoint?: (stepId: string, subpointId: string, progress: number) => void;
  /** While replaying, every waypoint stays soft so the moving robot stands out. */
  replaying?: boolean;
  /** Named points; the ones this auto doesn't use show as pins that add a linked step. */
  points?: NamedPoint[];
  onAddFromPoint?: (pointId: string) => void;
  /** Moves the point a leg faces; `pointId` is set when it snapped onto a named point. */
  onChangeFace?: (stepId: string, x: number, y: number, pointId: string | null) => void;
  /** Where the robot actually went the last time it ran this auto. */
  actual?: ActualPoint[];
  /** Point numbers by step id, counted over every drive step (both sides of each branch); route order when missing. */
  driveNumbers?: Map<string, number>;
  /** The sides of branches the field isn't showing, drawn faintly; click one of their points to show that side. */
  ghosts?: GhostRoute[];
  /** Camera coverage at the pose being shown; left out when the tag view is off. */
  vision?: VisionOverlay;
};

/** The other side of a branch: from the point before it, through its points, to the point after the branch. */
export type GhostRoute = { from: Point | null; points: { stepId: string; x: number; y: number }[]; to: Point | null };

/**
 * What each camera covers at one moment: a wedge for its field of view, and a line to every tag it
 * can use there. The wedge is the raw field of view, so a tag inside it with no line is one the
 * field blocks, is too far, or is turned too far away.
 */
export type VisionOverlay = {
  cones: { id: string; name: string; color: string; x: number; y: number; yaw: number; hFov: number; range: number }[];
  lines: { key: string; color: string; from: Point; to: Point; title: string }[];
};

/**
 * Field view in the blue-origin frame. Click to add a point, drag to box-select, drag a robot
 * to move it (the whole selection moves together), drag its handle to aim. Positions snap to
 * other points' X/Y and to 45° lines from neighbors; headings snap to 45° steps and nearby
 * headings. Hold Ctrl to place freely; Shift-click toggles selection.
 */
export function AutoField({ auto, field, layout, robot, stateColor, selectedStepIds, replay, pose,
  onSelectSteps, onAddPoint, onMovePoints, onChangeHeading, onChangeSubpoint, replaying = false,
  points = [], onAddFromPoint, onChangeFace, actual, driveNumbers, ghosts = [], vision }: AutoFieldProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const scale = viewWidth / field.length;
  const viewHeight = field.width * scale;
  const px = (x: number) => x * scale;
  const py = (y: number) => viewHeight - y * scale;
  const selected = new Set(selectedStepIds);

  const steps = auto?.steps ?? [];
  const drives = steps.flatMap(step => step.type === "drive" ? [{ step }] : []);
  const prompt = drives.length === 0 ? "Click to place where the robot starts"
    : drives.length === 1 ? "Click where the robot should drive next"
      : drives.length === 2 && !selectedStepIds.length ? "Drag a robot to move it · drag its dot to aim it" : null;

  const toField = (event: { clientX: number; clientY: number }) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x / scale, y: (viewHeight - point.y) / scale };
  };
  /** Meters per screen pixel, so snapping feels the same at any window size. */
  const metersPerPixel = () => 1 / (scale * (svgRef.current?.getScreenCTM()?.a ?? 1));
  const clampX = (value: number) => Math.min(Math.max(value, 0), field.length);
  const clampY = (value: number) => Math.min(Math.max(value, 0), field.width);

  const begin = (event: ReactPointerEvent, drag: Drag) => {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = drag;
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 4) return;
    drag.moved = true;
    const point = toField(event);
    if (!point) return;
    const snapping = !(event.ctrlKey || event.metaKey);

    if (drag.kind === "surface") {
      setOverlay({ guides: [], marquee: { a: drag.start, b: point } });
    } else if (drag.kind === "move") {
      const origin = drag.origins.get(drag.stepId)!;
      let target = { x: clampX(origin.x + point.x - drag.grab.x), y: clampY(origin.y + point.y - drag.grab.y) };
      let guides: SnapGuide[] = [];
      if (snapping) {
        const index = drives.findIndex(drive => drive.step.id === drag.stepId);
        const moving = new Set(drag.ids);
        const others = drives.filter(drive => !moving.has(drive.step.id));
        const label = (id: string) => `point ${drives.findIndex(drive => drive.step.id === id) + 1}`;
        const xs: AxisTarget[] = [...others.map(drive => ({ value: drive.step.x, label: `X of ${label(drive.step.id)}`, at: drive.step.y })),
          { value: field.length / 2, label: "center line" }];
        const ys: AxisTarget[] = [...others.map(drive => ({ value: drive.step.y, label: `Y of ${label(drive.step.id)}`, at: drive.step.x })),
          { value: field.width / 2, label: "field middle" }];
        const anchors = [drives[index - 1], drives[index + 1]].filter(drive => drive && !moving.has(drive.step.id))
          .map(drive => ({ point: { x: drive.step.x, y: drive.step.y }, label: label(drive.step.id) }));
        const snapped = snapPosition(target, { xs, ys, anchors }, snapPixels * metersPerPixel(), field);
        target = snapped.point;
        guides = snapped.guides;
      }
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      onMovePoints(drag.ids.map(id => {
        const start = drag.origins.get(id)!;
        return { stepId: id, x: round(clampX(start.x + dx), 3), y: round(clampY(start.y + dy), 3) };
      }));
      setOverlay({ guides, hint: snapping ? "Hold Ctrl to place freely" : "Snapping off" });
    } else if (drag.kind === "rotate") {
      const index = drives.findIndex(drive => drive.step.id === drag.stepId);
      const step = drives[index]?.step;
      if (!step) return;
      const raw = Math.atan2(point.y - step.y, point.x - step.x) * 180 / Math.PI;
      let heading = Math.round(raw);
      let label: string | null = null;
      if (event.shiftKey) {
        heading = Math.round(raw / 15) * 15;
        label = `${normalizeHeading(heading)}°`;
      } else if (snapping) {
        const previous = drives[index - 1]?.step;
        const next = drives[index + 1]?.step;
        const extras = [
          ...(previous ? [{ value: Math.atan2(step.y - previous.y, step.x - previous.x) * 180 / Math.PI, label: "along the path" },
            { value: previous.heading, label: `same as point ${index}` }] : []),
          ...(next ? [{ value: Math.atan2(next.y - step.y, next.x - step.x) * 180 / Math.PI, label: `toward point ${index + 2}` },
            { value: next.heading, label: `same as point ${index + 2}` }] : [])
        ];
        const snapped = snapHeading(raw, extras, headingSnapDegrees);
        heading = Math.round(snapped.heading * 10) / 10;
        label = snapped.label;
      }
      onChangeHeading(step.id, normalizeHeading(heading));
      setOverlay({ guides: [], note: { at: point, text: label ?? `${normalizeHeading(heading)}°` },
        hint: snapping ? "Ctrl: rotate freely · Shift: 15° steps" : "Snapping off" });
    } else if (drag.kind === "face") {
      // Dropping the face point near a named point links to it, such as the hub.
      const near = snapping ? points.find(named => Math.hypot(named.x - point.x, named.y - point.y) <= snapPixels * metersPerPixel()) : undefined;
      onChangeFace?.(drag.stepId, near ? near.x : round(clampX(point.x)), near ? near.y : round(clampY(point.y)), near?.id ?? null);
      setOverlay({ guides: [], note: near ? { at: { x: near.x, y: near.y }, text: `Face ${near.name}` } : undefined,
        hint: snapping ? "Drop on a named point to face it" : "Snapping off" });
    } else if (drag.kind === "subpoint") {
      // Subpoints slide along the planned straight line from the previous point.
      const index = drives.findIndex(drive => drive.step.id === drag.stepId);
      if (index > 0) onChangeSubpoint?.(drag.stepId, drag.subpointId, round(legProgress(drives[index - 1].step, point, drives[index].step)));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setOverlay(null);
    if (!drag) return;
    if (drag.kind === "surface") {
      const point = toField(event);
      if (!drag.moved) {
        onAddPoint(round(clampX(drag.start.x)), round(clampY(drag.start.y)));
      } else if (point) {
        const [minX, maxX] = [Math.min(drag.start.x, point.x), Math.max(drag.start.x, point.x)];
        const [minY, maxY] = [Math.min(drag.start.y, point.y), Math.max(drag.start.y, point.y)];
        const inside = drives.filter(({ step }) => step.x >= minX && step.x <= maxX && step.y >= minY && step.y <= maxY).map(({ step }) => step.id);
        onSelectSteps(inside, drag.additive ? "add" : "replace");
      }
    } else if (drag.kind === "move" && !drag.moved && drag.reselect) {
      // Clicking one robot of a selection (without dragging) selects just that robot.
      onSelectSteps([drag.stepId], "replace");
    }
  };

  const startMove = (event: ReactPointerEvent, step: DriveStep) => {
    const additive = event.shiftKey;
    const isSelected = selected.has(step.id);
    let group: string[];
    if (additive) {
      onSelectSteps([step.id], "toggle");
      group = isSelected ? [] : [...selectedStepIds, step.id];
    } else if (!isSelected) {
      onSelectSteps([step.id], "replace");
      group = [step.id];
    } else {
      group = selectedStepIds;
    }
    const ids = drives.filter(drive => group.includes(drive.step.id)).map(drive => drive.step.id);
    const grab = toField(event);
    if (!grab || !ids.includes(step.id)) { event.stopPropagation(); return; }
    begin(event, { kind: "move", stepId: step.id, ids, grab, clientX: event.clientX, clientY: event.clientY, moved: false,
      origins: new Map(drives.filter(drive => ids.includes(drive.step.id)).map(drive => [drive.step.id, { x: drive.step.x, y: drive.step.y }])),
      reselect: !additive && isSelected && selectedStepIds.length > 1 });
  };

  // The route from the replay, split where the requested state changes.
  const route = useMemo(() => {
    if (!replay || replay.frames.length < 2) return { runs: [] as { color: string; points: string }[], dots: [] as { x: number; y: number; color: string }[], arrows: [] as { x: number; y: number; angle: number; color: string }[] };
    const changes = [...replay.stateChanges].sort((a, b) => a.t - b.t);
    let changeIndex = 0;
    let state: string | null = null;
    const runs: { color: string; points: Point[] }[] = [];
    const dots: { x: number; y: number; color: string }[] = [];
    const frames = replay.frames;
    frames.forEach((frame, index) => {
      while (changeIndex < changes.length && changes[changeIndex].t <= frame.t + 1e-9) state = changes[changeIndex++].state;
      const color = stateColor(state);
      const point = { x: px(frame.x), y: py(frame.y) };
      const last = runs[runs.length - 1];
      if (!last || last.color !== color) runs.push({ color, points: last ? [last.points[last.points.length - 1], point] : [point] });
      else last.points.push(point);
      // One dot per tenth of a second while moving, so spacing shows speed.
      if (index % Math.round(0.1 / loopPeriodSeconds) === 0 && frame.speed > 0.05) dots.push({ ...point, color });
    });
    // A direction arrow halfway through each drive leg.
    const arrows = replay.segments.filter(segment => segment.type === "drive" && segment.end - segment.start > 0.2).flatMap(segment => {
      const a = frameAt(replay, (segment.start + segment.end) / 2);
      const b = frameAt(replay, (segment.start + segment.end) / 2 + loopPeriodSeconds);
      if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) return [];
      return [{ x: px(a.x), y: py(a.y), angle: Math.atan2(py(b.y) - py(a.y), px(b.x) - px(a.x)) * 180 / Math.PI, color: stateColor(segment.state) }];
    });
    return { runs: runs.map(run => ({ color: run.color, points: run.points.map(point => `${point.x},${point.y}`).join(" ") })), dots, arrows };
  }, [replay, stateColor, scale, viewHeight]);

  // Where each subpoint actually fires along the route.
  const subpointMarks = useMemo(() => !replay ? [] : replay.stateChanges.flatMap(change => {
    const frame = change.subpointId ? frameAt(replay, change.t) : undefined;
    return frame && change.subpointId ? [{ stepId: change.stepId, subpointId: change.subpointId, x: px(frame.x), y: py(frame.y), state: change.state }] : [];
  }), [replay, scale, viewHeight]);

  const robotShape = (step: { x: number; y: number; heading: number }, travel: number, stroke: string, fill: string, centerColor: string | null) => {
    const length = robot.length * scale;
    const width = robot.width * scale;
    const inset = Math.min(length, width) * 0.21;
    const wheelLength = 0.13 * scale;
    const wheelWidth = 0.05 * scale;
    // Wheels point along the direction of travel, in the robot's own frame.
    const wheelAngle = -normalizeHeading(travel - step.heading);
    return <>
      <rect x={-length / 2} y={-width / 2} width={length} height={width} rx={0.08 * scale} fill={fill} stroke={stroke} strokeWidth="1.8" />
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => <g key={`${sx}${sy}`} transform={`translate(${sx * (length / 2 - inset)} ${sy * (width / 2 - inset)})`}>
        <circle r={0.09 * scale} fill="none" stroke={stroke} strokeOpacity=".3" strokeWidth="1" />
        <rect x={-wheelLength / 2} y={-wheelWidth / 2} width={wheelLength} height={wheelWidth} rx={wheelWidth / 2}
          fill={stroke} fillOpacity=".9" transform={`rotate(${wheelAngle})`} />
      </g>)}
      <line x1={length / 2 - 0.07 * scale} y1={-width * 0.24} x2={length / 2 - 0.07 * scale} y2={width * 0.24} stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      {centerColor && <circle r="3" fill={centerColor} />}
    </>;
  };

  const handleDistance = robot.length * scale / 2 + 0.32 * scale;

  return (
    <svg ref={svgRef} className={`auto-field${replaying ? " replaying" : ""}`} viewBox={`-14 -14 ${viewWidth + 28} ${viewHeight + 28}`}
      role="img" aria-label="Auto path on the field" preserveAspectRatio="xMidYMid meet"
      onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; setOverlay(null); }}>
      <defs>
        <pattern id="auto-field-grid" width={scale} height={scale} patternUnits="userSpaceOnUse" y={viewHeight % scale}>
          <path d={`M ${scale} 0 H 0 V ${scale}`} fill="none" stroke="#2a3f4d" strokeWidth="1" />
        </pattern>
      </defs>
      <rect className="auto-field-surface" width={viewWidth} height={viewHeight} rx="5" fill="#101e29" stroke="#7993a5" strokeWidth="3"
        onPointerDown={event => {
          const point = toField(event);
          if (!auto || !point || event.button !== 0) return;
          begin(event, { kind: "surface", clientX: event.clientX, clientY: event.clientY, start: point, additive: event.shiftKey, moved: false });
        }} />
      {layout ? <FieldBackdrop layout={layout} width={viewWidth} height={viewHeight} labels /> : <>
        <rect width={viewWidth} height={viewHeight} fill="url(#auto-field-grid)" pointerEvents="none" />
        <rect width="16" height={viewHeight} fill="#307de0" opacity=".55" pointerEvents="none" />
        <rect x={viewWidth - 16} width="16" height={viewHeight} fill="#ec4d5d" opacity=".55" pointerEvents="none" />
        <path d={`M ${viewWidth / 2} 0 V ${viewHeight}`} stroke="#698191" strokeDasharray="10 9" pointerEvents="none" />
      </>}

      {/* What the cameras cover, under the route so it never hides the path. */}
      {vision && <g className="ab-vision" pointerEvents="none">
        {vision.cones.map(cone => {
          const half = cone.hFov / 2 * Math.PI / 180, aim = cone.yaw * Math.PI / 180;
          const edge = (sign: number) => `${px(cone.x + Math.cos(aim + sign * half) * cone.range)},${py(cone.y + Math.sin(aim + sign * half) * cone.range)}`;
          // Large-arc is never needed: a field of view at or past 180° isn't a lens this model describes.
          return <path key={cone.id} fill={cone.color} fillOpacity=".07" stroke={cone.color} strokeOpacity=".3" strokeWidth="1"
            d={`M ${px(cone.x)},${py(cone.y)} L ${edge(1)} A ${cone.range * scale} ${cone.range * scale} 0 0 1 ${edge(-1)} Z`}>
            <title>{`${cone.name}: ${cone.hFov}° wide, out to ${cone.range.toFixed(1)} m`}</title>
          </path>;
        })}
        {vision.lines.map(line => <line key={line.key} x1={px(line.from.x)} y1={py(line.from.y)} x2={px(line.to.x)} y2={py(line.to.y)}
          stroke={line.color} strokeOpacity=".85" strokeWidth="1.4"><title>{line.title}</title></line>)}
      </g>}

      <g pointerEvents="none">
        {/* Straight lines to each target, under the route the robot actually takes. */}
        {drives.slice(1).map((drive, index) => <line key={drive.step.id} x1={px(drives[index].step.x)} y1={py(drives[index].step.y)}
          x2={px(drive.step.x)} y2={py(drive.step.y)} stroke={nodeColor} strokeOpacity=".22" strokeWidth="1.2" strokeDasharray="4 5" />)}
        {route.runs.map((run, index) => <polyline key={index} points={run.points} fill="none" stroke={run.color} strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round" />)}
        {route.dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r="2.6" fill={dot.color} stroke="#0b1220" strokeWidth="1" />)}
        {route.arrows.map((arrow, index) => <path key={index} transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
          d="M -5 -5 L 3 0 L -5 5" fill="none" stroke={arrow.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />)}
      </g>

      {/* The sides of branches not shown, faint and dotted, rejoining the route after the branch. */}
      {ghosts.map((ghost, index) => {
        const line = [...(ghost.from ? [ghost.from] : []), ...ghost.points, ...(ghost.to ? [ghost.to] : [])];
        return <g key={index} className="ab-ghost">
          {line.length > 1 && <polyline points={line.map(point => `${px(point.x)},${py(point.y)}`).join(" ")} fill="none" stroke="#c4b5fd"
            strokeOpacity=".45" strokeWidth="1.6" strokeDasharray="2 6" strokeLinecap="round" pointerEvents="none" />}
          {ghost.points.map(point => <circle key={point.stepId} cx={px(point.x)} cy={py(point.y)} r="6" fill="#0b1220" stroke="#c4b5fd" strokeOpacity=".7" strokeWidth="1.6"
            onPointerDown={event => { event.stopPropagation(); if (event.button === 0) onSelectSteps([point.stepId], "replace"); }}>
            <title>{`Point ${driveNumbers?.get(point.stepId) ?? ""} on the other side of a branch. Click to show that side.`}</title>
          </circle>)}
        </g>;
      })}

      {/* Where the robot actually went last time, over the ideal route. */}
      {actual && actual.length > 1 && <g pointerEvents="none" className="ab-actual">
        <polyline points={actual.map(point => `${px(point.x)},${py(point.y)}`).join(" ")} fill="none" stroke="#f8fafc" strokeOpacity=".85"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={px(actual[actual.length - 1].x)} cy={py(actual[actual.length - 1].y)} r="5" fill="none" stroke="#f8fafc" strokeWidth="1.8" />
      </g>}

      {/* Named points this auto doesn't use; click one to drive there. */}
      {points.filter(point => !drives.some(({ step }) => step.pointId === point.id)).map(point =>
        <g key={point.id} className="ab-pin" transform={`translate(${px(point.x)} ${py(point.y)})`}
          onPointerDown={event => { event.stopPropagation(); if (event.button === 0) onAddFromPoint?.(point.id); }}>
          <circle r="6" fill="#0b1220" stroke="#c084fc" strokeWidth="2" />
          <circle r="2" fill="#c084fc" />
          <text className="ab-pin-label" y="-10" textAnchor="middle">{point.name}</text>
          <title>{`${point.name}: click to add a drive step here, linked to this point`}</title>
        </g>)}

      {subpointMarks.map(mark => <g key={mark.subpointId} className="ab-subpoint" transform={`translate(${mark.x} ${mark.y})`}
        onPointerDown={event => {
          onSelectSteps([mark.stepId], "replace");
          begin(event, { kind: "subpoint", stepId: mark.stepId, subpointId: mark.subpointId, clientX: event.clientX, clientY: event.clientY, moved: false });
        }}>
        <rect x="-5.5" y="-5.5" width="11" height="11" transform="rotate(45)" fill={stateColor(mark.state)} stroke="#0b1220" strokeWidth="2" />
        <title>{`${mark.state ?? "No state"} requested here. Drag along the path to move it.`}</title>
      </g>)}

      {/* Selected robots draw last, so they and their handles sit on top of overlapping robots. */}
      {drives.map((drive, index) => ({ ...drive, index })).sort((a, b) => Number(selected.has(a.step.id)) - Number(selected.has(b.step.id))).map(({ step, index }) => {
        const isSelected = selected.has(step.id);
        const previous = drives[index - 1]?.step;
        const next = drives[index + 1]?.step;
        const travel = previous ? Math.atan2(step.y - previous.y, step.x - previous.x) * 180 / Math.PI
          : next ? Math.atan2(next.y - step.y, next.x - step.x) * 180 / Math.PI : step.heading;
        const stroke = isSelected ? selectedColor : nodeColor;
        const center = index === 0 ? "#4ade80" : index === drives.length - 1 ? "#f87171" : null;
        const heading = legEndHeading(step);
        const facing = step.turn.mode === "face" ? step.turn : null;
        const linkedName = step.pointId ? points.find(point => point.id === step.pointId)?.name : undefined;
        return <g key={step.id} className={`ab-node${isSelected ? " selected" : ""}`} transform={`translate(${px(step.x)} ${py(step.y)})`}>
          {facing && isSelected && <g className="ab-face" transform={`translate(${px(facing.x) - px(step.x)} ${py(facing.y) - py(step.y)})`}
            onPointerDown={event => { if (event.button === 0) begin(event, { kind: "face", stepId: step.id, clientX: event.clientX, clientY: event.clientY, moved: false }); }}>
            <line x1={px(step.x) - px(facing.x)} y1={py(step.y) - py(facing.y)} x2="0" y2="0" stroke={selectedColor} strokeWidth="1.2" strokeDasharray="3 4" pointerEvents="none" />
            <circle r="9" fill="rgba(11, 18, 32, 0.6)" stroke={selectedColor} strokeWidth="1.8" />
            <path d="M -13 0 H -4 M 4 0 H 13 M 0 -13 V -4 M 0 4 V 13" stroke={selectedColor} strokeWidth="1.8" strokeLinecap="round" />
            <circle r="15" fill="transparent" />
            <title>The point this leg faces. Drag it; drop it on a named point to link them.</title>
          </g>}
          <g transform={`rotate(${-heading})`} onPointerDown={event => { if (event.button === 0) startMove(event, step); }}>
            {robotShape({ ...step, heading }, travel, stroke, isSelected ? "rgba(250, 204, 21, 0.14)" : "rgba(11, 18, 32, 0.55)", center)}
            {!facing && <g className="ab-node-handle" onPointerDown={event => {
              if (event.button !== 0) return;
              if (!isSelected) onSelectSteps([step.id], "replace");
              begin(event, { kind: "rotate", stepId: step.id, clientX: event.clientX, clientY: event.clientY, moved: false });
            }}>
              <line x1={robot.length * scale / 2} y1="0" x2={handleDistance} y2="0" stroke={stroke} strokeWidth="1.4" />
              <circle cx={handleDistance} cy="0" r="5.5" fill="#f8fafc" stroke="#0b1220" strokeWidth="1.5" />
              <circle cx={handleDistance} cy="0" r="12" fill="transparent" />
              <title>Drag to aim. Snaps to 45° and nearby headings; Shift for 15° steps, Ctrl to turn freely.</title>
            </g>}
          </g>
          <text className="ab-node-label" x={-robot.length * scale / 2 - 3} y={-robot.width * scale / 2 - 4}>{driveNumbers?.get(step.id) ?? index + 1}</text>
          {linkedName && <text className="ab-node-link" x={0} y={robot.width * scale / 2 + 14} textAnchor="middle">{linkedName}</text>}
        </g>;
      })}

      {pose && <g transform={`translate(${px(pose.x)} ${py(pose.y)}) rotate(${-pose.heading})`} pointerEvents="none">
        {robotShape(pose, pose.travel ?? pose.heading, selectedColor, "rgba(250, 204, 21, 0.3)", null)}
      </g>}

      {overlay && <g pointerEvents="none">
        {overlay.guides.map((guide, index) => <g key={index}>
          <line x1={px(guide.from.x)} y1={py(guide.from.y)} x2={px(guide.to.x)} y2={py(guide.to.y)} stroke={guideColor} strokeWidth="1.3" strokeDasharray="6 4" />
          <text className="ab-guide-label" x={px(guide.to.x) + 8} y={py(guide.to.y) - 8 - index * 14}>{guide.label}</text>
        </g>)}
        {overlay.marquee && <rect x={px(Math.min(overlay.marquee.a.x, overlay.marquee.b.x))} y={py(Math.max(overlay.marquee.a.y, overlay.marquee.b.y))}
          width={Math.abs(overlay.marquee.a.x - overlay.marquee.b.x) * scale} height={Math.abs(overlay.marquee.a.y - overlay.marquee.b.y) * scale}
          fill="rgba(250, 204, 21, 0.08)" stroke={selectedColor} strokeDasharray="5 4" />}
        {overlay.note && <text className="ab-guide-label" x={px(overlay.note.at.x) + 12} y={py(overlay.note.at.y) - 10}>{overlay.note.text}</text>}
        {overlay.hint && <text className="ab-guide-hint" x={viewWidth - 6} y={viewHeight - 8} textAnchor="end">{overlay.hint}</text>}
      </g>}

      {!auto && <text x={viewWidth / 2} y={viewHeight / 2} textAnchor="middle" fill="#a8bbca" fontSize="22">Create or pick an auto to start</text>}
      {/* The next action, so a new auto needs no instructions. */}
      {auto && prompt && <g pointerEvents="none">
        <rect x={viewWidth / 2 - prompt.length * 4.6 - 14} y="14" width={prompt.length * 9.2 + 28} height="30" rx="15" fill="rgba(11, 18, 32, 0.82)" stroke="rgba(250, 204, 21, 0.5)" />
        <text className="ab-field-prompt" x={viewWidth / 2} y="34" textAnchor="middle">{prompt}</text>
      </g>}
    </svg>
  );
}
