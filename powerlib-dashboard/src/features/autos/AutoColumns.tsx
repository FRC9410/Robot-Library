import { useRef, useState } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

/** Side column sizes in the Auto Builder; a closed column keeps its width for when it reopens. */
export type ColumnLayout = { left: number; right: number; leftOpen: boolean; rightOpen: boolean };

const storageKey = "powerlib.autoBuilder.columns.v1";
const defaults: ColumnLayout = { left: 220, right: 340, leftOpen: true, rightOpen: true };
/** Dragging a column narrower than this closes it. */
const closeBelow = 110;
const limits = { left: { min: 160, max: 420 }, right: { min: 260, max: 620 } };

export function useColumnLayout() {
  const [layout, setLayout] = useState<ColumnLayout>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return { ...defaults, ...Object.fromEntries(Object.entries(saved).filter(([key, value]) => key in defaults && typeof value === typeof defaults[key as keyof ColumnLayout])) };
    } catch {
      return defaults;
    }
  });
  const update = (next: ColumnLayout) => {
    setLayout(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Sizes just won't persist. */ }
  };
  return [layout, update] as const;
}

/**
 * Drag handle between columns. Drag to resize; drag past the edge to close the column, and drag
 * back out (or click) to reopen it. Double-click toggles.
 */
export function ColumnSplitter({ side, layout, onChange }: { side: "left" | "right"; layout: ColumnLayout; onChange: (layout: ColumnLayout) => void }) {
  const drag = useRef<{ startX: number; startWidth: number; moved: boolean } | null>(null);
  const open = side === "left" ? layout.leftOpen : layout.rightOpen;
  const width = side === "left" ? layout.left : layout.right;
  const set = (nextOpen: boolean, nextWidth = width) => onChange(side === "left"
    ? { ...layout, leftOpen: nextOpen, left: nextWidth } : { ...layout, rightOpen: nextOpen, right: nextWidth });
  const Icon = (side === "left") === open ? ChevronLeftIcon : ChevronRightIcon;

  return <div className={`ab-splitter${open ? "" : " closed"}`} role="separator" aria-orientation="vertical"
    aria-label={`${open ? "Resize or hide" : "Show"} the ${side === "left" ? "autos" : "steps"} column`}
    title={open ? "Drag to resize; drag to the edge to hide" : "Drag or click to show"}
    onPointerDown={event => {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startX: event.clientX, startWidth: open ? width : 0, moved: false };
    }}
    onPointerMove={event => {
      if (!drag.current || !(event.buttons & 1)) return;
      const dx = (event.clientX - drag.current.startX) * (side === "left" ? 1 : -1);
      if (!drag.current.moved && Math.abs(dx) < 3) return;
      drag.current.moved = true;
      const raw = drag.current.startWidth + dx;
      if (raw < closeBelow) set(false);
      else set(true, Math.round(Math.min(limits[side].max, Math.max(limits[side].min, raw))));
    }}
    onPointerUp={() => {
      if (drag.current && !drag.current.moved && !open) set(true);
      drag.current = null;
    }}
    onDoubleClick={() => set(!open)}>
    <span className="ab-splitter-grip"><Icon sx={{ fontSize: 14 }} /></span>
  </div>;
}

export const gridColumns = (layout: ColumnLayout) =>
  `${layout.leftOpen ? layout.left : 0}px 12px minmax(0, 1fr) 12px ${layout.rightOpen ? layout.right : 0}px`;
