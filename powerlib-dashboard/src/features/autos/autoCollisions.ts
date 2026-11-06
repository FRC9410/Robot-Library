// Warns when the robot would hit a solid field element along an auto. It checks the robot's bumper
// rectangle, turned to its heading, at every frame of the replay, so it follows rounded corners and
// turning the way the replay draws them. Works for any field layout that lists its solid elements.
import type { Occluder } from "../field/fieldObstacles";
import type { AutoIssue } from "./autoModel";
import type { Replay } from "./autoReplay";

/** Robot size in meters with bumpers, as in PathPlanner's settings: length front to back, width side to side. */
export type RobotFootprint = { width: number; length: number };

/**
 * Elements that start this close to the carpet block driving. Ones higher up, such as a bar robots
 * drive under, are left out: whether the robot fits under is up to its height.
 */
export const groundClearanceMeters = 0.05;

/** Field elements a robot can't drive through: the layout's sight-line blockers that reach the carpet. */
export function groundObstacles(occluders: Occluder[]) {
  return occluders.filter(box => box.z0 < groundClearanceMeters);
}

/** Whether the robot's rectangle at `pose` (heading in degrees) overlaps the box's footprint, by separating axes. */
export function robotOverlaps(footprint: RobotFootprint, pose: { x: number; y: number; heading: number }, box: Occluder) {
  const radians = pose.heading * Math.PI / 180;
  const forward = { x: Math.cos(radians), y: Math.sin(radians) };
  const left = { x: -forward.y, y: forward.x };
  const halfLength = footprint.length / 2, halfWidth = footprint.width / 2;
  const boxCenter = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
  const boxHalf = { x: (box.x1 - box.x0) / 2, y: (box.y1 - box.y0) / 2 };
  const offset = { x: pose.x - boxCenter.x, y: pose.y - boxCenter.y };
  for (const axis of [{ x: 1, y: 0 }, { x: 0, y: 1 }, forward, left]) {
    const robotReach = halfLength * Math.abs(forward.x * axis.x + forward.y * axis.y) + halfWidth * Math.abs(left.x * axis.x + left.y * axis.y);
    const boxReach = boxHalf.x * Math.abs(axis.x) + boxHalf.y * Math.abs(axis.y);
    // Touching isn't hitting.
    if (Math.abs(offset.x * axis.x + offset.y * axis.y) >= robotReach + boxReach - 1e-9) return false;
  }
  return true;
}

const listNames = (names: string[]) => names.length < 2 ? names.join("")
  : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/**
 * One warning per drive leg whose replayed motion overlaps a ground obstacle, naming what it hits.
 * The replay follows one side of each branch, so the other side is checked when it's shown.
 */
export function collisionIssues(replay: Replay, footprint: RobotFootprint, occluders: Occluder[]): Omit<AutoIssue, "autoId">[] {
  const obstacles = groundObstacles(occluders);
  if (!obstacles.length || !(footprint.width > 0) || !(footprint.length > 0)) return [];
  const legs = new Map(replay.segments.filter(segment => segment.type === "drive").map(segment => [segment.stepIndex, segment.stepId]));
  const hits = new Map<string, Set<string>>();
  for (const frame of replay.frames) {
    const stepId = legs.get(frame.stepIndex);
    if (!stepId) continue;
    for (const box of obstacles) {
      if (!robotOverlaps(footprint, frame, box)) continue;
      const names = hits.get(stepId) ?? new Set<string>();
      names.add(box.label ?? "a field element");
      hits.set(stepId, names);
    }
  }
  return [...hits].map(([stepId, names]) => ({ stepId, severity: "warning" as const,
    message: `The robot may hit ${listNames([...names])} on this leg. Move the point, add one to go around, or check the bumper size in PathPlanner's settings.` }));
}
