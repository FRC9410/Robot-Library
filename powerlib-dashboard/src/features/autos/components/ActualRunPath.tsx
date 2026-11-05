import type { ActualPoint } from "../autoActual";
import type { FieldFrame } from "../fieldGeometry";

type ActualRunPathProps = {
  points: ActualPoint[];
  frame: FieldFrame;
};

/** Where the robot actually went the last time it ran this auto, drawn over the ideal route. */
export function ActualRunPath({ points, frame }: ActualRunPathProps) {
  const { px, py } = frame;
  if (points.length < 2) return null;
  const end = points[points.length - 1];
  return <g pointerEvents="none" className="ab-actual">
    <polyline points={points.map(point => `${px(point.x)},${py(point.y)}`).join(" ")} fill="none" stroke="#f8fafc" strokeOpacity=".85"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={px(end.x)} cy={py(end.y)} r="5" fill="none" stroke="#f8fafc" strokeWidth="1.8" />
  </g>;
}
