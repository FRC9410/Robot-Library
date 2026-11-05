// What a drag on the Auto Builder field does: move points with snapping, aim them, box-select, or pick a face point.
import type { DriveStep, NamedPoint } from "./autoModel";
import { normalizeHeading, round } from "./autoModel";
import { snapHeading, snapPosition } from "./autoSnap";
import type { AxisTarget, SnapGuide } from "./autoSnap";
import { clampToField } from "./fieldGeometry";
import type { FieldPoint, FieldSize, PointMove } from "./types";

/** Snap distance in screen pixels, and heading snap in degrees. */
export const snapPixels = 9;
export const headingSnapDegrees = 7;

export type FieldDrag =
  | { kind: "surface"; clientX: number; clientY: number; start: FieldPoint; additive: boolean; moved: boolean }
  | { kind: "move"; stepId: string; ids: string[]; origins: Map<string, FieldPoint>; grab: FieldPoint; clientX: number; clientY: number; moved: boolean; reselect: boolean }
  | { kind: "rotate"; stepId: string; clientX: number; clientY: number; moved: boolean }
  | { kind: "subpoint"; stepId: string; subpointId: string; clientX: number; clientY: number; moved: boolean }
  | { kind: "face"; stepId: string; clientX: number; clientY: number; moved: boolean };

/** Snap guides, the box being dragged, a note by the pointer and a hint in the corner, drawn while dragging. */
export type DragOverlayState = { guides: SnapGuide[]; marquee?: { a: FieldPoint; b: FieldPoint }; note?: { at: FieldPoint; text: string }; hint?: string };

/**
 * Where the dragged points go. The grabbed point snaps to other points' X and Y, the center line,
 * the field middle and 45° lines from its neighbors; the rest of the selection moves with it.
 */
export function dragMoves(drives: DriveStep[], drag: Extract<FieldDrag, { kind: "move" }>, point: FieldPoint, snapping: boolean,
  threshold: number, field: FieldSize): { moves: PointMove[]; guides: SnapGuide[] } {
  const origin = drag.origins.get(drag.stepId)!;
  let target = { x: clampToField(origin.x + point.x - drag.grab.x, field.length), y: clampToField(origin.y + point.y - drag.grab.y, field.width) };
  let guides: SnapGuide[] = [];
  if (snapping) {
    const index = drives.findIndex(drive => drive.id === drag.stepId);
    const moving = new Set(drag.ids);
    const others = drives.filter(drive => !moving.has(drive.id));
    const label = (id: string) => `point ${drives.findIndex(drive => drive.id === id) + 1}`;
    const xs: AxisTarget[] = [...others.map(drive => ({ value: drive.x, label: `X of ${label(drive.id)}`, at: drive.y })),
      { value: field.length / 2, label: "center line" }];
    const ys: AxisTarget[] = [...others.map(drive => ({ value: drive.y, label: `Y of ${label(drive.id)}`, at: drive.x })),
      { value: field.width / 2, label: "field middle" }];
    const anchors = [drives[index - 1], drives[index + 1]].filter(drive => drive && !moving.has(drive.id))
      .map(drive => ({ point: { x: drive.x, y: drive.y }, label: label(drive.id) }));
    const snapped = snapPosition(target, { xs, ys, anchors }, threshold, field);
    target = snapped.point;
    guides = snapped.guides;
  }
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  return {
    moves: drag.ids.map(id => {
      const start = drag.origins.get(id)!;
      return { stepId: id, x: round(clampToField(start.x + dx, field.length), 3), y: round(clampToField(start.y + dy, field.width), 3) };
    }),
    guides
  };
}

/**
 * The heading for a robot aimed at `point`: 15° steps with Shift, otherwise snapped to 45° steps,
 * the path direction and the neighbors' headings unless snapping is off.
 */
export function aimHeading(drives: DriveStep[], index: number, point: FieldPoint, fifteenDegreeSteps: boolean, snapping: boolean) {
  const step = drives[index];
  const raw = Math.atan2(point.y - step.y, point.x - step.x) * 180 / Math.PI;
  if (fifteenDegreeSteps) {
    const heading = Math.round(raw / 15) * 15;
    return { heading: normalizeHeading(heading), label: `${normalizeHeading(heading)}°` };
  }
  if (!snapping) return { heading: normalizeHeading(Math.round(raw)), label: null };
  const previous = drives[index - 1];
  const next = drives[index + 1];
  const extras = [
    ...(previous ? [{ value: Math.atan2(step.y - previous.y, step.x - previous.x) * 180 / Math.PI, label: "along the path" },
      { value: previous.heading, label: `same as point ${index}` }] : []),
    ...(next ? [{ value: Math.atan2(next.y - step.y, next.x - step.x) * 180 / Math.PI, label: `toward point ${index + 2}` },
      { value: next.heading, label: `same as point ${index + 2}` }] : [])
  ];
  const snapped = snapHeading(raw, extras, headingSnapDegrees);
  return { heading: normalizeHeading(Math.round(snapped.heading * 10) / 10), label: snapped.label };
}

/** The named point a dragged face point lands on, when it is within `threshold` meters. */
export const namedPointNear = (points: NamedPoint[], point: FieldPoint, threshold: number) =>
  points.find(named => Math.hypot(named.x - point.x, named.y - point.y) <= threshold);

/** The drive points inside the box from `a` to `b`. */
export function boxSelection(drives: DriveStep[], a: FieldPoint, b: FieldPoint) {
  const [minX, maxX] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [minY, maxY] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return drives.filter(step => step.x >= minX && step.x <= maxX && step.y >= minY && step.y <= maxY).map(step => step.id);
}

/**
 * Which robots a press on one robot drags. Shift toggles it in the selection; pressing an unselected
 * robot selects just it; pressing a selected one drags the whole selection.
 */
export function moveGroup(stepId: string, selection: string[], additive: boolean) {
  const isSelected = selection.includes(stepId);
  if (additive) return { select: "toggle" as const, group: isSelected ? [] : [...selection, stepId] };
  if (!isSelected) return { select: "replace" as const, group: [stepId] };
  return { select: null, group: selection };
}
