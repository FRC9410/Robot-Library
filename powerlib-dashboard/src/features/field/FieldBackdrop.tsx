import { useId } from "react";
import type { FieldLayout, FieldTag } from "./fieldLayouts";
import type { DrawingRect } from "./rebuiltDrawing";

const allianceColors = { blue: "#3b82f6", red: "#ef4444" };
const labelStyle = { fontSize: 10, fontWeight: 600, letterSpacing: 1, fill: "#e2e8f0" } as const;

type Label = { x: number; y: number; anchor: "start" | "middle" | "end" };

/** Solid shapes are obstacles, shaded ones are driven over, dashed ones are driven under or zones. */
function DrawingShape({ shape, scale, height, labels }: { shape: DrawingRect; scale: number; height: number; labels: boolean }) {
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

// Tag marker drawn facing +x: flat back on the tag face, pointed toward where the tag looks.
const marker = { width: 12, body: 10, point: 5 };
const markerPath = `M 0 ${-marker.width / 2} H ${marker.body} L ${marker.body + marker.point} 0 L ${marker.body} ${marker.width / 2} H 0 Z`;

function TagMarker({ tag, scale, height }: { tag: FieldTag; scale: number; height: number }) {
  const x = tag.x * scale, y = height - tag.y * scale, radians = tag.yaw * Math.PI / 180;
  const textX = x + Math.cos(radians) * marker.body / 2, textY = y - Math.sin(radians) * marker.body / 2;
  return <g>
    <title>{`AprilTag ${tag.id}`}</title>
    <path d={markerPath} transform={`translate(${x} ${y}) rotate(${-tag.yaw})`} fill="#f8fafc" fillOpacity=".95" stroke="#0f172a" strokeWidth=".75" strokeLinejoin="round" />
    <text x={textX} y={textY} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill="#0f172a">{tag.id}</text>
  </g>;
}

/**
 * Draws a field layout under a field drawn as `width` × `height` SVG units with the blue origin at the
 * bottom left: either the WPILib image with its calibrated corners on the field edges, or the simplified
 * drawing. `labels` names the drawing's elements and marks the official AprilTags.
 */
export function FieldBackdrop({ layout, width, height, labels = false }: { layout: FieldLayout; width: number; height: number; labels?: boolean }) {
  const clipId = `field-clip-${useId().replaceAll(":", "")}`;
  const { image, drawing } = layout;
  const scale = width / layout.length;
  return <g pointerEvents="none">
    <defs><clipPath id={clipId}><rect width={width} height={height} rx="5" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      {image && <image href={image.href} x={-image.left * width / (image.right - image.left)} y={-image.top * height / (image.bottom - image.top)}
        width={image.pixelWidth * width / (image.right - image.left)} height={image.pixelHeight * height / (image.bottom - image.top)}
        preserveAspectRatio="none" transform={image.rotate180 ? `rotate(180 ${width / 2} ${height / 2})` : undefined} />}
      {drawing?.map((shape, index) => <DrawingShape key={index} shape={shape} scale={scale} height={height} labels={labels} />)}
      {labels && layout.tags.map(tag => <TagMarker key={tag.id} tag={tag} scale={scale} height={height} />)}
    </g>
  </g>;
}
