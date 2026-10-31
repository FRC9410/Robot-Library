import { useId } from "react";
import type { FieldLayout } from "./fieldLayouts";
import type { DrawingRect } from "./rebuiltDrawing";

const allianceColors = { blue: "#307de0", red: "#ec4d5d" };
const labels: Partial<Record<DrawingRect["element"], string>> = { hub: "HUB", bump: "BUMP", trench: "TRENCH", tower: "TOWER", depot: "DEPOT", outpost: "OUTPOST", fuel: "FUEL" };

function DrawingShape({ shape, scale, height, label }: { shape: DrawingRect; scale: number; height: number; label: boolean }) {
  const color = shape.alliance ? allianceColors[shape.alliance] : "#e2e8f0";
  const x = shape.x * scale, y = height - (shape.y + shape.width) * scale, w = shape.length * scale, h = shape.width * scale;
  const text = label && labels[shape.element] && <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
    fontSize="11" fontWeight="700" fill="#f8fafc" stroke="#101e29" strokeWidth="3" paintOrder="stroke">{labels[shape.element]}</text>;
  switch (shape.element) {
    case "centerLine": return <rect x={x} y={y} width={w} height={h} fill={color} opacity=".7" />;
    case "startingLine": return <rect x={x} y={y} width={w} height={h} fill={color} />;
    case "fuel": return <g><rect x={x} y={y} width={w} height={h} fill="#facc15" fillOpacity=".18" stroke="#facc15" strokeDasharray="4 3" />{text}</g>;
    case "hub": return <g><rect x={x} y={y} width={w} height={h} fill={color} stroke="#f8fafc" strokeWidth="1.5" />{text}</g>;
    case "bump": return <g><rect x={x} y={y} width={w} height={h} fill={color} fillOpacity=".45" stroke={color} strokeWidth="1.5" />{text}</g>;
    case "trench": return <g><rect x={x} y={y} width={w} height={h} fill={color} fillOpacity=".12" stroke={color} strokeWidth="1.5" strokeDasharray="5 3" />{text}</g>;
    case "outpost": return <g><line x1={x} y1={y} x2={x} y2={y + h} stroke={color} strokeWidth="6" />
      {label && <text x={x + (shape.alliance === "red" ? -6 : 6)} y={y + h / 2} textAnchor={shape.alliance === "red" ? "end" : "start"} dominantBaseline="central"
        fontSize="11" fontWeight="700" fill="#f8fafc" stroke="#101e29" strokeWidth="3" paintOrder="stroke">OUTPOST</text>}</g>;
    default: return <g><rect x={x} y={y} width={w} height={h} fill={color} fillOpacity=".25" stroke={color} strokeWidth="2" />{text}</g>;
  }
}

/**
 * Draws a field layout under a field drawn as `width` × `height` SVG units with the blue origin at the
 * bottom left: either the WPILib image with its calibrated corners on the field edges, or the simplified
 * drawing. `showTags` adds the official AprilTags and element labels.
 */
export function FieldBackdrop({ layout, width, height, showTags = false }: { layout: FieldLayout; width: number; height: number; showTags?: boolean }) {
  const clipId = `field-clip-${useId().replaceAll(":", "")}`;
  const { image, drawing } = layout;
  const scale = width / layout.length;
  return <g pointerEvents="none">
    <defs><clipPath id={clipId}><rect width={width} height={height} rx="5" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      {image && <image href={image.href} x={-image.left * width / (image.right - image.left)} y={-image.top * height / (image.bottom - image.top)}
        width={image.pixelWidth * width / (image.right - image.left)} height={image.pixelHeight * height / (image.bottom - image.top)}
        preserveAspectRatio="none" transform={image.rotate180 ? `rotate(180 ${width / 2} ${height / 2})` : undefined} />}
      {drawing?.map((shape, index) => <DrawingShape key={index} shape={shape} scale={scale} height={height} label={showTags} />)}
    </g>
    {showTags && layout.tags.map(tag => {
      const x = tag.x * scale, y = height - tag.y * scale, radians = tag.yaw * Math.PI / 180;
      return <g key={tag.id}>
        <line x1={x} y1={y} x2={x + Math.cos(radians) * 14} y2={y - Math.sin(radians) * 14} stroke="#f8fafc" strokeWidth="2" />
        <circle cx={x} cy={y} r="4" fill="#f8fafc" stroke="#14212c" strokeWidth="1.5" />
        <text x={x} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="#f8fafc" stroke="#14212c" strokeWidth="3" paintOrder="stroke">{tag.id}</text>
      </g>;
    })}
  </g>;
}
