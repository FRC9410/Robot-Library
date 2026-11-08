// Smart snapping for drive poses on the field. Pure math, so it can be checked without a browser.
import { normalizeHeading } from "./autoModel";

type Point = { x: number; y: number };

/** A guide drawn while a snap is active, in field meters. */
export type SnapGuide = { from: Point; to: Point; label: string };

/**
 * A value to align with. `at` is the source's coordinate on the other axis (another point's Y
 * for an X target), so the guide connects the two; without it the guide spans the field.
 */
export type AxisTarget = { value: number; label: string; at?: number };

export type PositionTargets = {
  xs: AxisTarget[];
  ys: AxisTarget[];
  /** Points whose 45° lines the dragged point may sit on (its neighbors along the path). */
  anchors: { point: Point; label: string }[];
};

type Candidate = { point: Point; guides: SnapGuide[]; constraints: number; distance: number };

const angleStep = 45;
const radians = (degrees: number) => degrees * Math.PI / 180;

function nearest(value: number, options: AxisTarget[], threshold: number) {
  let best: AxisTarget | undefined;
  for (const option of options) {
    if (Math.abs(option.value - value) <= threshold && (!best || Math.abs(option.value - value) < Math.abs(best.value - value))) best = option;
  }
  return best;
}

/** The 45° ray from an anchor that passes closest to the point, if the point is near it. */
function angleSnap(point: Point, anchor: Point, threshold: number) {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const distance = Math.hypot(dx, dy);
  if (distance < threshold * 2) return undefined;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const snapped = Math.round(angle / angleStep) * angleStep;
  const along = distance * Math.cos(radians(angle - snapped));
  const off = Math.abs(distance * Math.sin(radians(angle - snapped)));
  if (off > threshold || along <= 0) return undefined;
  return { angle: snapped, direction: { x: Math.cos(radians(snapped)), y: Math.sin(radians(snapped)) }, along };
}

/**
 * Snaps a dragged point to other points' X or Y and to 45° lines from its neighbors. Two
 * constraints at once (such as same X and a 45° line) win over one; ties go to the closest.
 * `threshold` is in meters; pass the size of a few screen pixels.
 */
export function snapPosition(point: Point, targets: PositionTargets, threshold: number, field: { length: number; width: number }) {
  const candidates: Candidate[] = [];
  const add = (snapped: Point, guides: SnapGuide[], constraints: number) =>
    candidates.push({ point: snapped, guides, constraints, distance: Math.hypot(snapped.x - point.x, snapped.y - point.y) });
  const xGuide = (target: AxisTarget, y: number): SnapGuide => target.at === undefined
    ? { from: { x: target.value, y: 0 }, to: { x: target.value, y: field.width }, label: target.label }
    : { from: { x: target.value, y: target.at }, to: { x: target.value, y }, label: target.label };
  const yGuide = (target: AxisTarget, x: number): SnapGuide => target.at === undefined
    ? { from: { x: 0, y: target.value }, to: { x: field.length, y: target.value }, label: target.label }
    : { from: { x: target.at, y: target.value }, to: { x, y: target.value }, label: target.label };

  const sameX = nearest(point.x, targets.xs, threshold);
  const sameY = nearest(point.y, targets.ys, threshold);
  if (sameX) add({ x: sameX.value, y: point.y }, [xGuide(sameX, point.y)], 1);
  if (sameY) add({ x: point.x, y: sameY.value }, [yGuide(sameY, point.x)], 1);
  if (sameX && sameY) add({ x: sameX.value, y: sameY.value }, [xGuide(sameX, sameY.value), yGuide(sameY, sameX.value)], 2);

  for (const anchor of targets.anchors) {
    const snap = angleSnap(point, anchor.point, threshold);
    if (!snap) continue;
    const ray = (end: Point): SnapGuide => ({ from: anchor.point, to: end, label: `${normalizeHeading(snap.angle)}° from ${anchor.label}` });
    const onRay = { x: anchor.point.x + snap.direction.x * snap.along, y: anchor.point.y + snap.direction.y * snap.along };
    add(onRay, [ray(onRay)], 1);
    // Where the 45° line crosses an aligned X or Y, both hold.
    if (sameX && Math.abs(snap.direction.x) > 1e-6) {
      const t = (sameX.value - anchor.point.x) / snap.direction.x;
      const crossing = { x: sameX.value, y: anchor.point.y + snap.direction.y * t };
      if (t > 0) add(crossing, [ray(crossing), xGuide(sameX, crossing.y)], 2);
    }
    if (sameY && Math.abs(snap.direction.y) > 1e-6) {
      const t = (sameY.value - anchor.point.y) / snap.direction.y;
      const crossing = { x: anchor.point.x + snap.direction.x * t, y: sameY.value };
      if (t > 0) add(crossing, [ray(crossing), yGuide(sameY, crossing.x)], 2);
    }
  }

  const best = candidates
    .filter(candidate => candidate.distance <= threshold * (candidate.constraints > 1 ? 1.5 : 1))
    .sort((a, b) => b.constraints - a.constraints || a.distance - b.distance)[0];
  return best ? { point: best.point, guides: best.guides } : { point, guides: [] as SnapGuide[] };
}

/** Snaps a heading to 45° multiples (so 90° too) or to headings that matter for this point. */
export function snapHeading(degrees: number, extras: { value: number; label: string }[], threshold: number) {
  const options = [...extras, ...Array.from({ length: 8 }, (_, index) => ({ value: normalizeHeading(index * 45), label: `${normalizeHeading(index * 45)}°` }))];
  let best: { value: number; label: string } | undefined;
  let bestError = Number.POSITIVE_INFINITY;
  // Extras come first and win ties, so "same as point 2" reads better than the bare angle.
  for (const option of options) {
    const error = Math.abs(normalizeHeading(degrees - option.value));
    if (error <= threshold && error < bestError - 1e-9) {
      best = option;
      bestError = error;
    }
  }
  return best ? { heading: normalizeHeading(best.value), label: best.label } : { heading: normalizeHeading(degrees), label: null };
}
