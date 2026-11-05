import type { FieldTag } from "../fieldLayouts";

// Tag marker drawn facing +x: flat back on the tag face, pointed toward where the tag looks.
const marker = { width: 12, body: 10, point: 5 };
const markerPath = `M 0 ${-marker.width / 2} H ${marker.body} L ${marker.body + marker.point} 0 L ${marker.body} ${marker.width / 2} H 0 Z`;

type FieldTagMarkerProps = {
  tag: FieldTag;
  /** SVG units per meter, and the field's height in SVG units (Y is flipped). */
  scale: number;
  height: number;
};

/** An AprilTag on the field: its number in an arrow pointing where the tag faces. */
export function FieldTagMarker({ tag, scale, height }: FieldTagMarkerProps) {
  const x = tag.x * scale, y = height - tag.y * scale, radians = tag.yaw * Math.PI / 180;
  const textX = x + Math.cos(radians) * marker.body / 2, textY = y - Math.sin(radians) * marker.body / 2;
  return <g>
    <title>{`AprilTag ${tag.id}`}</title>
    <path d={markerPath} transform={`translate(${x} ${y}) rotate(${-tag.yaw})`} fill="#f8fafc" fillOpacity=".95" stroke="#0f172a" strokeWidth=".75" strokeLinejoin="round" />
    <text x={textX} y={textY} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill="#0f172a">{tag.id}</text>
  </g>;
}
