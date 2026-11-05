import type { DrawingRect } from "../rebuiltDrawing";

const allianceColors = { blue: "#3b82f6", red: "#ef4444" };
const labelStyle = { fontSize: 10, fontWeight: 600, letterSpacing: 1, fill: "#e2e8f0" } as const;

type Label = { x: number; y: number; anchor: "start" | "middle" | "end" };

type FieldDrawingShapeProps = {
  shape: DrawingRect;
  /** SVG units per meter, and the field's height in SVG units (Y is flipped). */
  scale: number;
  height: number;
  labels: boolean;
};

/** Solid shapes are obstacles, shaded ones are driven over, dashed ones are driven under or zones. */
export function FieldDrawingShape({ shape, scale, height, labels }: FieldDrawingShapeProps) {
  const color = shape.alliance ? allianceColors[shape.alliance] : "#94a3b8";
  const x = shape.x * scale, y = height - (shape.y + shape.width) * scale, w = shape.length * scale, h = shape.width * scale;
  const box = { x, y, width: w, height: h };
  const red = shape.alliance === "red";
  let label: Label | null = labels && shape.label ? { x: x + w / 2, y: y + h / 2, anchor: "middle" } : null;
  let body;
  switch (shape.element) {
    case "centerLine": body = <rect {...box} fill={color} opacity=".55" />; break;
    case "startingLine": body = <rect {...box} fill={color} />; break;
    case "fuel": body = <rect {...box} fill="#facc15" fillOpacity=".07" stroke="#facc15" strokeOpacity=".5" strokeDasharray="6 4" />; break;
    case "hub": body = <rect {...box} fill={color} stroke="#f8fafc" strokeWidth="1.5" />; break;
    case "hubOpening": body = <polygon fill="#0f172a" fillOpacity=".28" stroke="#f8fafc" strokeOpacity=".85" strokeWidth="1.2" strokeLinejoin="round"
      points={[[x, y + h / 2], [x + w / 4, y], [x + w * 3 / 4, y], [x + w, y + h / 2], [x + w * 3 / 4, y + h], [x + w / 4, y + h]].join(" ")} />; break;
    case "trenchPost": body = <rect {...box} fill={color} />; break;
    case "trenchBar": body = <rect {...box} fill={color} stroke="#f8fafc" strokeOpacity=".5" strokeWidth=".75" />; break;
    case "trench": body = <rect {...box} fill={color} fillOpacity=".06" stroke={color} strokeOpacity=".8" strokeWidth="1.5" strokeDasharray="6 4" />; break;
    case "bump": body = <g>
      <rect {...box} fill={color} fillOpacity=".25" stroke={color} strokeWidth="1.5" />
      {/* Seam where the ramp from the alliance zone meets the ramp from the neutral zone. */}
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#f8fafc" strokeOpacity=".55" strokeWidth="1.2" />
    </g>; break;
    case "tower":
      body = <rect {...box} fill={color} fillOpacity=".3" stroke={color} strokeWidth="2" />;
      // The tower is centered on one wall tag with the other toward the center line, so the label takes the free half.
      if (label) label = { ...label, y: y + h * (red ? 0.22 : 0.78) };
      break;
    case "towerRung": body = <rect {...box} rx={w / 2} fill="#f8fafc" fillOpacity=".85" />; break;
    case "towerUpright": body = <rect {...box} fill={color} stroke="#f8fafc" strokeWidth=".75" />; break;
    case "depot":
      body = <rect {...box} fill={color} fillOpacity=".12" stroke={color} strokeWidth="1.5" />;
      // Too shallow to hold its label, so the label sits just inside the field beside it.
      if (label) label = red ? { x: x - 6, y: y + h / 2, anchor: "end" } : { x: x + w + 6, y: y + h / 2, anchor: "start" };
      break;
    case "outpost":
      body = <line x1={x} y1={y} x2={x} y2={y + h} stroke={color} strokeWidth="6" />;
      // Past the outpost's tag markers on the wall.
      if (label) label = red ? { x: x - 24, y: y + h / 2, anchor: "end" } : { x: x + 24, y: y + h / 2, anchor: "start" };
      break;
  }
  return <g>
    {body}
    {label && <text x={label.x} y={label.y} textAnchor={label.anchor} dominantBaseline="central" {...labelStyle}>{shape.label}</text>}
  </g>;
}
