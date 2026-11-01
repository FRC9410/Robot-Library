/**
 * Heights for the simplified field drawing's shapes, so a camera's sight line to an AprilTag can be
 * blocked by the field itself. The drawing gives each shape's footprint; this gives the band of
 * height it fills, in meters above the carpet.
 *
 * Where a shape carries AprilTags, its height is anchored to the tag centers in the WPILib layout
 * (which `npm run check:fields` checks): the hub's tags sit at 1.124 m and the trench bar's at
 * 0.889 m, so each must reach at least that high. The rest are rounded estimates from the game
 * manual's figures, and only matter for sight lines, never for the autos themselves.
 */
import type { DrawingElement, DrawingRect } from "./rebuiltDrawing";

/** A box that blocks sight lines, in field coordinates and meters. */
export type Occluder = { element: DrawingElement; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

/**
 * The height band each shape fills. Shapes left out are zones, tape or ramps that a camera can see
 * over or through, so they never block anything.
 */
const heights: Partial<Record<DrawingElement, { z0: number; z1: number }>> = {
  // Solid on all four sides, with a tag centered on each face at 1.124 m; open only at the top.
  hub: { z0: 0, z1: 1.3 },
  // The overhead arm robots drive under, with a tag on each face at 0.889 m.
  trenchBar: { z0: 0.78, z1: 1.0 },
  // The solid support beside the bump, as tall as the trench structure.
  trenchPost: { z0: 0, z1: 1.0 },
  // Thin verticals, 1.5 in across, so their shadows are narrow.
  towerUpright: { z0: 0, z1: 2 },
  // The climbing pipe through the middle of the uprights.
  towerRung: { z0: 1.5, z1: 1.55 }
};

/** The drawing's shapes as sight-line blockers. The tower itself is open framing, so only its parts count. */
export function fieldOccluders(drawing: DrawingRect[]): Occluder[] {
  return drawing.flatMap(shape => {
    const band = heights[shape.element];
    return band ? [{ element: shape.element, x0: shape.x, x1: shape.x + shape.length,
      y0: shape.y, y1: shape.y + shape.width, ...band }] : [];
  });
}

/**
 * Whether the segment from `from` to `to` passes through the box, by the slab method. Both ends sit
 * on a camera or a tag face rather than inside a box, so touching an edge doesn't count as blocked.
 */
export function blocks(box: Occluder, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
  const direction = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  let near = 0, far = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const start = from[axis], step = direction[axis];
    const low = box[`${axis}0`], high = box[`${axis}1`];
    if (Math.abs(step) < 1e-12) {
      if (start <= low || start >= high) return false;
      continue;
    }
    const first = (low - start) / step, second = (high - start) / step;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near >= far) return false;
  }
  // A grazing hit at either end is the camera or the tag's own surface, not something in the way.
  return far - near > 1e-6;
}
