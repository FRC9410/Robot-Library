import type { RouteVision, VisionQuality } from "../autoVision";

/** The tag strip's colors, from a fix the robot would trust to none at all. */
const visionColors: Record<VisionQuality, string> = {
  good: "#22c55e",
  fair: "#eab308",
  poor: "#f97316",
  blind: "#52525b"
};

type VisionStripProps = {
  vision: RouteVision;
  /** Converts seconds to a CSS position along the timeline. */
  percent: (seconds: number) => string;
};

/** AprilTag coverage along the route, lined up under the timeline. */
export function VisionStrip({ vision, percent }: VisionStripProps) {
  return <div className="ab-vision-strip" aria-label="AprilTag coverage">
    {vision.spans.map(span => <div key={span.start} className={`ab-vision-span ${span.quality}`}
      style={{ left: percent(span.start), width: percent(span.end - span.start), background: visionColors[span.quality] }}
      title={span.quality === "blind"
        ? `No usable tags from ${span.start.toFixed(1)} s to ${span.end.toFixed(1)} s`
        : `${span.tagCount} tag${span.tagCount === 1 ? "" : "s"}, to within ${((span.stdDev ?? 0) * 100).toFixed(1)} cm`} />)}
  </div>;
}
