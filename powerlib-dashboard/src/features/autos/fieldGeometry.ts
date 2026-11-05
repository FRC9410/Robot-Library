// Field drawing math for the Auto Builder: meters to SVG units, the replay route and where subpoints fire.
import type { DriveStep } from "./autoModel";
import type { Replay } from "./autoReplay";
import { frameAt, loopPeriodSeconds } from "./autoReplay";
import type { FieldPoint, FieldSize } from "./types";

/** The field is drawn 1000 SVG units long, in the blue-origin frame. */
export const fieldViewWidth = 1000;

export const fieldColors = {
  node: "#e2e8f0",
  selected: "#facc15",
  guide: "#22d3ee",
  namedPoint: "#c084fc",
  ghost: "#c4b5fd",
  start: "#4ade80",
  end: "#f87171",
  ink: "#0b1220"
};

/** Converts field meters to SVG units; `py` flips Y so the field's +Y points up. */
export type FieldFrame = { scale: number; width: number; height: number; px: (x: number) => number; py: (y: number) => number };

export function fieldFrame(field: FieldSize): FieldFrame {
  const scale = fieldViewWidth / field.length;
  const height = field.width * scale;
  return { scale, width: fieldViewWidth, height, px: x => x * scale, py: y => height - y * scale };
}

/** Field meters under the pointer, from the SVG's transform on screen. */
export function pointerToField(svg: SVGSVGElement | null, frame: FieldFrame, event: { clientX: number; clientY: number }): FieldPoint | null {
  const matrix = svg?.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x / frame.scale, y: (frame.height - point.y) / frame.scale };
}

/** Meters per screen pixel, so snapping feels the same at any window size. */
export const metersPerPixel = (svg: SVGSVGElement | null, frame: FieldFrame) => 1 / (frame.scale * (svg?.getScreenCTM()?.a ?? 1));

export const clampToField = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/** The route from the replay in SVG units, split where the requested state changes. */
export function routeDrawing(replay: Replay | undefined, stateColor: (state: string | null) => string, frame: FieldFrame) {
  const runs: { color: string; points: FieldPoint[] }[] = [];
  const dots: { x: number; y: number; color: string }[] = [];
  if (!replay || replay.frames.length < 2) return { runs: [] as { color: string; points: string }[], dots, arrows: [] as { x: number; y: number; angle: number; color: string }[] };
  const changes = [...replay.stateChanges].sort((a, b) => a.t - b.t);
  let changeIndex = 0;
  let state: string | null = null;
  replay.frames.forEach((replayFrame, index) => {
    while (changeIndex < changes.length && changes[changeIndex].t <= replayFrame.t + 1e-9) state = changes[changeIndex++].state;
    const color = stateColor(state);
    const point = { x: frame.px(replayFrame.x), y: frame.py(replayFrame.y) };
    const last = runs[runs.length - 1];
    if (!last || last.color !== color) runs.push({ color, points: last ? [last.points[last.points.length - 1], point] : [point] });
    else last.points.push(point);
    // One dot per tenth of a second while moving, so spacing shows speed.
    if (index % Math.round(0.1 / loopPeriodSeconds) === 0 && replayFrame.speed > 0.05) dots.push({ ...point, color });
  });
  // A direction arrow halfway through each drive leg.
  const arrows = replay.segments.filter(segment => segment.type === "drive" && segment.end - segment.start > 0.2).flatMap(segment => {
    const a = frameAt(replay, (segment.start + segment.end) / 2);
    const b = frameAt(replay, (segment.start + segment.end) / 2 + loopPeriodSeconds);
    if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) return [];
    return [{ x: frame.px(a.x), y: frame.py(a.y), angle: Math.atan2(frame.py(b.y) - frame.py(a.y), frame.px(b.x) - frame.px(a.x)) * 180 / Math.PI,
      color: stateColor(segment.state) }];
  });
  return { runs: runs.map(run => ({ color: run.color, points: run.points.map(point => `${point.x},${point.y}`).join(" ") })), dots, arrows };
}

export type SubpointMark = { stepId: string; subpointId: string; x: number; y: number; state: string | null };

/** Where each subpoint actually fires along the route, in SVG units. */
export const subpointMarks = (replay: Replay | undefined, frame: FieldFrame): SubpointMark[] => !replay ? [] : replay.stateChanges.flatMap(change => {
  const at = change.subpointId ? frameAt(replay, change.t) : undefined;
  return at && change.subpointId ? [{ stepId: change.stepId, subpointId: change.subpointId, x: frame.px(at.x), y: frame.py(at.y), state: change.state }] : [];
});

/** The direction a waypoint robot travels, for its wheels: from the previous point, else toward the next. */
export function legTravel(drives: DriveStep[], index: number) {
  const step = drives[index];
  const previous = drives[index - 1];
  const next = drives[index + 1];
  return previous ? Math.atan2(step.y - previous.y, step.x - previous.x) * 180 / Math.PI
    : next ? Math.atan2(next.y - step.y, next.x - step.x) * 180 / Math.PI : step.heading;
}

/** The next thing to do on the field, so a new auto needs no instructions; null once the auto has a few points. */
export const fieldPrompt = (driveCount: number, selectionCount: number) => driveCount === 0 ? "Click to place where the robot starts"
  : driveCount === 1 ? "Click where the robot should drive next"
    : driveCount === 2 && !selectionCount ? "Drag a robot to move it · drag its dot to aim it" : null;
