import type { FieldFrame } from "../fieldGeometry";
import { fieldColors } from "../fieldGeometry";
import type { GhostRoute } from "../types";

type BranchGhostProps = {
  ghost: GhostRoute;
  frame: FieldFrame;
  driveNumbers?: Map<string, number>;
  /** Picks a point on this side, which shows the side on the field. */
  onPick: (stepId: string) => void;
};

/** The side of a branch the field isn't showing: faint and dotted, rejoining the route after the branch. */
export function BranchGhost({ ghost, frame, driveNumbers, onPick }: BranchGhostProps) {
  const { px, py } = frame;
  const line = [...(ghost.from ? [ghost.from] : []), ...ghost.points, ...(ghost.to ? [ghost.to] : [])];
  return <g className="ab-ghost">
    {line.length > 1 && <polyline points={line.map(point => `${px(point.x)},${py(point.y)}`).join(" ")} fill="none" stroke={fieldColors.ghost}
      strokeOpacity=".45" strokeWidth="1.6" strokeDasharray="2 6" strokeLinecap="round" pointerEvents="none" />}
    {ghost.points.map(point => <circle key={point.stepId} cx={px(point.x)} cy={py(point.y)} r="6" fill={fieldColors.ink} stroke={fieldColors.ghost}
      strokeOpacity=".7" strokeWidth="1.6"
      onPointerDown={event => { event.stopPropagation(); if (event.button === 0) onPick(point.stepId); }}>
      <title>{`Point ${driveNumbers?.get(point.stepId) ?? ""} on the other side of a branch. Click to show that side.`}</title>
    </circle>)}
  </g>;
}
