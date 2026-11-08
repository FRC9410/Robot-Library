import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Box } from "@mui/material";
import type { FieldLayout } from "../../field/fieldLayouts";
import { FieldView } from "../../field/components/FieldView";
import { normalizeHeading, type AutoRoutine, type DriveStep } from "../autoModel";

type AutoEditorFieldProps = { auto: AutoRoutine | undefined; layout: FieldLayout | null; dimensions: { length: number; width: number };
  flip: boolean; pose?: { x: number; y: number; heading: number }; selectedId: string | null; disabled: boolean;
  onAdd: (sourceId: string, point: { x: number; y: number }) => void; onSelect: (id: string) => void; onMove: (id: string, point: { x: number; y: number }) => void;
  onHeading: (id: string, heading: number) => void };

export function AutoEditorField({ auto, layout, dimensions, flip, pose, selectedId, disabled, onAdd, onSelect, onMove, onHeading }: AutoEditorFieldProps) {
  const drag = useRef<{ id: string; mode: "position" | "heading" | "create"; pointerId: number;
    startX?: number; startY?: number; moved?: boolean } | null>(null);
  const [preview, setPreview] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [dragMode, setDragMode] = useState<"position" | "heading" | "create" | null>(null);
  const field = layout ?? dimensions;
  const height = 480, width = height * field.length / field.width;
  const points = (auto?.steps ?? []).filter((step): step is DriveStep => step.type === "drive");
  const pixel = (step: { x: number; y: number }) => ({ x: step.x / field.length * width, y: height - step.y / field.width * height });
  function cancelDrag() { drag.current = null; setPreview(null); setDragMode(null); }
  useEffect(cancelDrag, [auto?.id, disabled, flip, field.length, field.width]);
  function beginDrag(event: PointerEvent<SVGGElement>, id: string, mode: "position" | "heading" | "create") {
    event.stopPropagation();
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    onSelect(id);
    drag.current = { id, mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    setDragMode(mode);
    const svg = event.currentTarget.ownerSVGElement;
    svg?.focus({ preventScroll: true }); svg?.setPointerCapture(event.pointerId);
  }
  function fieldCoordinates(svg: SVGSVGElement, clientX: number, clientY: number) {
    const matrix = svg.getScreenCTM(); if (!matrix) return null;
    const local = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: (flip ? width - local.x : local.x) / width * field.length,
      y: (flip ? local.y : height - local.y) / height * field.width };
  }
  function coordinates(svg: SVGSVGElement, clientX: number, clientY: number, clamp = false) {
    const point = fieldCoordinates(svg, clientX, clientY); if (!point) return null;
    let { x, y } = point;
    if (!clamp && (x < 0 || x > field.length || y < 0 || y > field.width)) return null;
    x = Math.max(0, Math.min(field.length, x)); y = Math.max(0, Math.min(field.width, y));
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  }
  return <Box sx={{ flex: 1, minHeight: 220, display: "flex", flexDirection: "column", minWidth: 0,
    userSelect: "none", WebkitUserSelect: "none", "& svg, & svg *": { userSelect: "none", WebkitUserSelect: "none" },
    "& svg:focus, & svg *:focus": { outline: "none" } }}>
    <Box sx={{ flex: 1, minHeight: 200, border: "1px solid", borderColor: "divider", borderRadius: 1,
      bgcolor: "#0d1922", "& > svg": { width: "100%", height: "100%", minHeight: 200, display: "block", touchAction: "none" } }}>
      <FieldView dimensions={dimensions} layout={layout} flip={flip} pose={pose} labels padding={72}
        onPointerMove={event => {
          const active = drag.current;
          if (!active || disabled || active.pointerId !== event.pointerId) return;
          if (active.mode === "heading") {
            const step = points.find(step => step.id === active.id);
            const point = fieldCoordinates(event.currentTarget, event.clientX, event.clientY);
            if (step && point && Math.hypot(point.x - step.x, point.y - step.y) > 0.02) {
              onHeading(step.id, normalizeHeading(Math.round(Math.atan2(point.y - step.y, point.x - step.x) * 180 / Math.PI)));
            }
          } else if (active.mode === "create") {
            if (Math.hypot(event.clientX - active.startX!, event.clientY - active.startY!) < 6 && !active.moved) return;
            active.moved = true;
            const point = coordinates(event.currentTarget, event.clientX, event.clientY, true);
            if (point && points.some(step => step.id === active.id)) setPreview({ sourceId: active.id, ...point });
          } else {
            const point = coordinates(event.currentTarget, event.clientX, event.clientY, true); if (point) onMove(active.id, point);
          }
        }} onPointerUp={event => {
          const active = drag.current;
          if (!active || active.pointerId !== event.pointerId) return;
          cancelDrag();
          if (disabled || active.mode !== "create" || !active.moved) return;
          const source = points.find(step => step.id === active.id);
          const point = coordinates(event.currentTarget, event.clientX, event.clientY, true);
          if (source && point && Math.hypot(point.x - source.x, point.y - source.y) >= 0.05) onAdd(source.id, point);
        }} onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) cancelDrag(); }}
        onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) cancelDrag(); }}
        onKeyDown={event => { if (event.key === "Escape" && drag.current?.mode === "create") { event.preventDefault(); cancelDrag(); } }}>
        {points.slice(1).map((step, index) => {
          const start = pixel(points[index]), end = pixel(step), selected = step.id === selectedId;
          return <line key={step.id} data-drive-leg={step.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
            stroke={selected ? "#fff" : "#facc15"} strokeWidth={selected ? 4 : 2} strokeDasharray="6 4" pointerEvents="none" />;
        })}
        {preview && points.some(step => step.id === preview.sourceId) && (() => {
          const source = pixel(points.find(step => step.id === preview.sourceId)!);
          const target = pixel(preview);
          return <g data-new-point-preview="true" pointerEvents="none">
            <path d={`M ${source.x} ${source.y} L ${target.x} ${target.y}`} stroke="#22c55e" strokeWidth="3" strokeDasharray="7 5" />
            <circle cx={target.x} cy={target.y} r="13" fill="#0d1922" stroke="#22c55e" strokeWidth="3" />
          </g>;
        })()}
        {points.map((step, index) => {
          const p = pixel(step), selected = step.id === selectedId;
          return <g key={step.id} data-auto-point={step.id} role="button" tabIndex={0} aria-label={`Drive point ${index + 1}`}
            transform={`translate(${p.x} ${p.y})`} style={{ cursor: disabled ? "default" : "grab" }}
            onPointerDown={event => beginDrag(event, step.id, "position")}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(step.id); } }}>
            <title>{index === 0 ? "Start point 1" : `Drive point ${index + 1}`}</title>
            <circle r="13" fill={selected ? "#facc15" : "#1e293b"} stroke="#facc15" strokeWidth="2" />
            <path d="M 14 0 H 27 M 21 -5 L 27 0 L 21 5" transform={`rotate(${-step.heading})`} stroke={selected ? "#fff" : "#facc15"} fill="none" strokeWidth="2" pointerEvents="none" />
            {selected && <g transform={`rotate(${-step.heading})`}>
              <path d="M 27 0 H 48" stroke="#fff" strokeWidth="2" pointerEvents="none" />
              <g role="button" tabIndex={disabled ? -1 : 0} aria-label={`Heading for drive point ${index + 1}`} aria-disabled={disabled}
                data-heading-handle={step.id} transform="translate(48 0)" style={{ cursor: disabled ? "default" : "crosshair" }}
                onPointerDown={event => beginDrag(event, step.id, "heading")} onKeyDown={event => {
                  event.stopPropagation();
                  if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                  event.preventDefault();
                  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? 1 : -1;
                  onHeading(step.id, normalizeHeading(step.heading + direction * (event.shiftKey ? 15 : 1)));
                }}>
                <title>Drag to set heading. Arrow keys adjust 1°; Shift adjusts 15°.</title>
                <circle r="22" fill="transparent" />
                <circle r="10" fill="#facc15" stroke="#fff" strokeWidth="3" pointerEvents="none" />
                <path d="M -4 -4 L 4 0 L -4 4" fill="none" stroke="#14212c" strokeWidth="2" pointerEvents="none" />
              </g>
            </g>}
            {selected && dragMode !== "heading" && <g transform={`rotate(${-step.heading}) translate(0 44)`} aria-label={`Create point from drive point ${index + 1}`}
              data-add-point-handle={step.id} style={{ cursor: disabled ? "default" : "crosshair" }}
              onPointerDown={event => beginDrag(event, step.id, "create")}>
              <title>Drag + to create a point after this one. Escape cancels.</title>
              <circle r="18" fill="transparent" />
              <circle r="10" fill="#0d1922" stroke="#22c55e" strokeWidth="2" pointerEvents="none" />
              <path d="M -5 0 H 5 M 0 -5 V 5" stroke="#22c55e" strokeWidth="2" pointerEvents="none" />
            </g>}
            <text data-point-number={index + 1} x="0" y="0" fill={selected ? "#14212c" : "#facc15"} fontSize={index > 98 ? 9 : 12} fontWeight="700"
              textAnchor="middle" dominantBaseline="central" transform={flip ? "rotate(180)" : undefined} pointerEvents="none">{index + 1}</text>
          </g>;
        })}
      </FieldView>
    </Box>
  </Box>;
}
