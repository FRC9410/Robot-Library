import { useRef } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ColumnLayout, ColumnSide } from "../autoColumns";
import { columnOpen, columnWidth, draggedColumn, withColumn } from "../autoColumns";

type ColumnSplitterProps = {
  side: ColumnSide;
  layout: ColumnLayout;
  onChange: (layout: ColumnLayout) => void;
};

/**
 * Drag handle between columns. Drag to resize; drag past the edge to close the column, and drag
 * back out (or click) to reopen it. Double-click toggles.
 */
export function ColumnSplitter({ side, layout, onChange }: ColumnSplitterProps) {
  const drag = useRef<{ startX: number; startWidth: number; moved: boolean } | null>(null);
  const open = columnOpen(layout, side);
  const Icon = (side === "left") === open ? ChevronLeftIcon : ChevronRightIcon;

  return <div className={`ab-splitter${open ? "" : " closed"}`} role="separator" aria-orientation="vertical"
    aria-label={`${open ? "Resize or hide" : "Show"} the ${side === "left" ? "autos" : "steps"} column`}
    title={open ? "Drag to resize; drag to the edge to hide" : "Drag or click to show"}
    onPointerDown={event => {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startX: event.clientX, startWidth: open ? columnWidth(layout, side) : 0, moved: false };
    }}
    onPointerMove={event => {
      if (!drag.current || !(event.buttons & 1)) return;
      const dx = (event.clientX - drag.current.startX) * (side === "left" ? 1 : -1);
      if (!drag.current.moved && Math.abs(dx) < 3) return;
      drag.current.moved = true;
      onChange(draggedColumn(layout, side, drag.current.startWidth + dx));
    }}
    onPointerUp={() => {
      if (drag.current && !drag.current.moved && !open) onChange(withColumn(layout, side, true));
      drag.current = null;
    }}
    onDoubleClick={() => onChange(withColumn(layout, side, !open))}>
    <span className="ab-splitter-grip"><Icon sx={{ fontSize: 14 }} /></span>
  </div>;
}
