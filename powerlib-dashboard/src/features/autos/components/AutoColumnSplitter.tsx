import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";

export function useAutoColumns() {
  const container = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem("powerlib.auto.columns") ?? "null");
      if (Array.isArray(value) && value.length === 2 && value.every(item => Number.isFinite(item) && item >= 160 && item <= 700)) return value as [number, number];
    } catch { /* Use default widths if storage is unavailable. */ }
    return [190, 290] as [number, number];
  });
  const [available, setAvailable] = useState(1000);
  useEffect(() => { if (!container.current) return; const observer = new ResizeObserver(entries => setAvailable(entries[0].contentRect.width)); observer.observe(container.current); return () => observer.disconnect(); }, []);
  useEffect(() => { try { localStorage.setItem("powerlib.auto.columns", JSON.stringify(widths)); } catch { /* Resizing still works without storage. */ } }, [widths]);
  const fit = (left: number, right: number) => {
    const budget = Math.max(420, available - 284), excess = Math.max(0, left + right - budget);
    return [Math.max(160, left - excess * .5), Math.max(260, right - excess * .5)];
  };
  const [left, right] = fit(...widths);
  return { container, template: `${left}px 12px minmax(260px, 1fr) 12px ${right}px`,
    splitter: (side: 0 | 1) => <AutoColumnSplitter label={side === 0 ? "Resize routines pane" : "Resize steps pane"} value={side === 0 ? left : right}
      onChange={value => setWidths(current => side === 0 ? [Math.max(160, Math.min(700, value, available - right - 284)), current[1]] : [current[0], Math.max(260, Math.min(700, value, available - left - 284))])}
      onReset={() => setWidths([190, 290])} reverse={side === 1} /> };
}
function AutoColumnSplitter({ label, value, onChange, onReset, reverse }: { label: string; value: number; onChange: (value: number) => void; onReset: () => void; reverse: boolean }) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  return <Box role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuenow={Math.round(value)}
    onDoubleClick={onReset} onKeyDown={event => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); onChange(value + (event.key === "ArrowRight" ? 10 : -10) * (reverse ? -1 : 1)); } }}
    onPointerDown={event => { if (event.button) return; event.preventDefault(); drag.current = { x: event.clientX, value }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => { if (drag.current) onChange(drag.current.value + (event.clientX - drag.current.x) * (reverse ? -1 : 1)); }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
    sx={{ display: { xs: "none", md: "block" }, cursor: "col-resize", touchAction: "none", userSelect: "none", borderRadius: 1,
      "&:hover, &:focus-visible": { bgcolor: "action.hover" } }} />;
}
