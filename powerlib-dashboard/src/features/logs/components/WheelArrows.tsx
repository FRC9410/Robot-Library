import { moduleCorners, travelAngle } from "../swerveModel";
import type { ModuleState } from "../wpilog";

type WheelArrowsProps = {
  modules: ModuleState[];
  /** Distance from the robot's center to each wheel, along x and along y. */
  inset: number;
  length: number;
  width: number;
  color: string;
  /** Overrides `color` for one wheel, e.g. to mark a wheel that's off. */
  colorOf?: (index: number) => string | undefined;
  dashed?: boolean;
};

/**
 * One arrow per swerve wheel, pointing the way it rolls. Drawn in the robot's frame inside a rotated group:
 * x forward and SVG y = -(robot y), so it turns with the robot.
 */
export function WheelArrows({ modules, inset, length, width, color, colorOf, dashed }: WheelArrowsProps) {
  return (
    <g>
      {modules.map((module, index) => {
        const [cornerX, cornerY] = moduleCorners[Math.min(index, moduleCorners.length - 1)];
        const x = cornerX * inset;
        const y = -cornerY * inset;
        const angle = travelAngle(module);
        const tipX = x + Math.cos(angle) * length;
        const tipY = y - Math.sin(angle) * length;
        const head = length * 0.35;
        const stroke = colorOf?.(index) ?? color;
        const side = (offset: number) => `${tipX - Math.cos(angle + offset) * head},${tipY + Math.sin(angle + offset) * head}`;
        return (
          <g key={index} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <line x1={x} y1={y} x2={tipX} y2={tipY} strokeDasharray={dashed ? `${width * 2} ${width * 1.5}` : undefined} />
            <polyline points={`${side(0.5)} ${tipX},${tipY} ${side(-0.5)}`} />
          </g>
        );
      })}
    </g>
  );
}
