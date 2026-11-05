import type { FieldFrame } from "../fieldGeometry";
import type { VisionOverlay } from "../types";

type CameraCoverageProps = {
  vision: VisionOverlay;
  frame: FieldFrame;
};

/** What the cameras cover: a wedge per camera and a line to each tag it can use. Drawn under the route. */
export function CameraCoverage({ vision, frame }: CameraCoverageProps) {
  const { px, py, scale } = frame;
  return <g className="ab-vision" pointerEvents="none">
    {vision.cones.map(cone => {
      const half = cone.hFov / 2 * Math.PI / 180;
      const aim = cone.yaw * Math.PI / 180;
      const edge = (sign: number) => `${px(cone.x + Math.cos(aim + sign * half) * cone.range)},${py(cone.y + Math.sin(aim + sign * half) * cone.range)}`;
      // Large-arc is never needed: a field of view at or past 180° isn't a lens this model describes.
      return <path key={cone.id} fill={cone.color} fillOpacity=".07" stroke={cone.color} strokeOpacity=".3" strokeWidth="1"
        d={`M ${px(cone.x)},${py(cone.y)} L ${edge(1)} A ${cone.range * scale} ${cone.range * scale} 0 0 1 ${edge(-1)} Z`}>
        <title>{`${cone.name}: ${cone.hFov}° wide, out to ${cone.range.toFixed(1)} m`}</title>
      </path>;
    })}
    {vision.lines.map(line => <line key={line.key} x1={px(line.from.x)} y1={py(line.from.y)} x2={px(line.to.x)} y2={py(line.to.y)}
      stroke={line.color} strokeOpacity=".85" strokeWidth="1.4"><title>{line.title}</title></line>)}
  </g>;
}
