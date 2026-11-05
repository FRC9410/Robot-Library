import type { DragOverlayState } from "../fieldDrag";
import type { FieldFrame } from "../fieldGeometry";
import { fieldColors } from "../fieldGeometry";

type DragOverlayProps = {
  overlay: DragOverlayState;
  frame: FieldFrame;
};

/** Snap guides, the selection box, a note by the pointer and a hint in the corner, while dragging. */
export function DragOverlay({ overlay, frame }: DragOverlayProps) {
  const { px, py, scale, width, height } = frame;
  const { guides, marquee, note, hint } = overlay;
  return <g pointerEvents="none">
    {guides.map((guide, index) => <g key={index}>
      <line x1={px(guide.from.x)} y1={py(guide.from.y)} x2={px(guide.to.x)} y2={py(guide.to.y)} stroke={fieldColors.guide} strokeWidth="1.3" strokeDasharray="6 4" />
      <text className="ab-guide-label" x={px(guide.to.x) + 8} y={py(guide.to.y) - 8 - index * 14}>{guide.label}</text>
    </g>)}
    {marquee && <rect x={px(Math.min(marquee.a.x, marquee.b.x))} y={py(Math.max(marquee.a.y, marquee.b.y))}
      width={Math.abs(marquee.a.x - marquee.b.x) * scale} height={Math.abs(marquee.a.y - marquee.b.y) * scale}
      fill="rgba(250, 204, 21, 0.08)" stroke={fieldColors.selected} strokeDasharray="5 4" />}
    {note && <text className="ab-guide-label" x={px(note.at.x) + 12} y={py(note.at.y) - 10}>{note.text}</text>}
    {hint && <text className="ab-guide-hint" x={width - 6} y={height - 8} textAnchor="end">{hint}</text>}
  </g>;
}
