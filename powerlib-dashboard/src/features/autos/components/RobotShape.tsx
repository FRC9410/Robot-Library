import { normalizeHeading } from "../autoModel";
import type { RobotSize } from "../types";

type RobotShapeProps = {
  robot: RobotSize;
  /** SVG units per meter. */
  scale: number;
  /** The robot's heading and its direction of travel, in degrees; the wheels point along the travel. */
  heading: number;
  travel: number;
  stroke: string;
  fill: string;
  /** A dot at the center, such as green for the start; none when null. */
  centerColor: string | null;
};

/** A swerve robot from above, drawn around (0, 0) facing +X: frame, four wheels and a bar across the front. */
export function RobotShape({ robot, scale, heading, travel, stroke, fill, centerColor }: RobotShapeProps) {
  const length = robot.length * scale;
  const width = robot.width * scale;
  const inset = Math.min(length, width) * 0.21;
  const wheelLength = 0.13 * scale;
  const wheelWidth = 0.05 * scale;
  // Wheels point along the direction of travel, in the robot's own frame.
  const wheelAngle = -normalizeHeading(travel - heading);
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
}
