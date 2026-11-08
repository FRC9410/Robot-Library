import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Box } from "@mui/material";
import type { FieldLayout } from "../../field/fieldLayouts";
import { FieldView } from "../../field/components/FieldView";
import { RobotFootprint } from "../../field/components/RobotFootprint";
import { legEndHeading, normalizeHeading, type AutoRoutine, type DriveStep, type NamedPoint } from "../autoModel";
import { snapHeading, snapPosition, type SnapGuide } from "../autoSnap";
import type { AutoSelectMode } from "../autoSelection";
import { AutoSubpointMarkers } from "./AutoSubpointMarkers";

type AutoEditorFieldProps = { auto: AutoRoutine | undefined; layout: FieldLayout | null; dimensions: { length: number; width: number };
  flip: boolean; pose?: { x: number; y: number; heading: number }; selectedId: string | null; disabled: boolean;
  onAdd: (sourceId: string, point: { x: number; y: number }) => void; onSelect: (id: string, mode?: AutoSelectMode, preserveGroup?: boolean) => void; onMove: (id: string, point: { x: number; y: number }) => void;
  onFace?: (id: string, point: { x: number; y: number }) => void; onHeading: (id: string, heading: number) => void; selectedIds?: string[]; snap?: boolean; namedPoints?: NamedPoint[];
  onSelection?: (ids: string[]) => void; onBegin?: () => void; onEnd?: (cancel?: boolean) => void;
  connectPoints?: boolean; allowCreation?: boolean; pointNames?: Record<string, string> };

export function AutoEditorField({ auto, layout, dimensions, flip, pose, selectedId, selectedIds = [], snap = false, namedPoints = [], onSelection, onBegin, onEnd, disabled, onAdd, onSelect, onMove, onHeading, onFace,
  connectPoints = true, allowCreation = true, pointNames }: AutoEditorFieldProps) {
  const drag = useRef<{ id: string; mode: "position" | "heading" | "create" | "face"; pointerId: number;
    startX: number; startY: number; moved: boolean; toggleOnClick: boolean; collapseOnClick: boolean } | null>(null);
  const [preview, setPreview] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [dragMode, setDragMode] = useState<"position" | "heading" | "create" | "face" | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const boxDrag = useRef<{ start: { x: number; y: number }; pointerId: number; additive: boolean; original: string[] } | null>(null);
  const [box, setBox] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const field = layout ?? dimensions;
  const height = 480, width = height * field.length / field.width;
  const points = (auto?.steps ?? []).filter((step): step is DriveStep => step.type === "drive");
  const pixel = (step: { x: number; y: number }) => ({ x: step.x / field.length * width, y: height - step.y / field.width * height });
  function cancelDrag(cancel = false) { if (drag.current) onEnd?.(cancel); drag.current = null; boxDrag.current = null; setBox(null); setGuides([]); setPreview(null); setDragMode(null); }
  useEffect(() => { cancelDrag(true); }, [auto?.id, disabled, flip, field.length, field.width]);
  function beginDrag(event: PointerEvent<SVGGElement>, id: string, mode: "position" | "heading" | "create" | "face") {
    event.stopPropagation();
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    const range = mode === "position" && event.shiftKey;
    const additive = mode === "position" && (event.ctrlKey || event.metaKey) && !range;
    const alreadySelected = selectedIds.includes(id) || selectedId === id;
    // Shift fills the range; Ctrl toggles a point. Defer Ctrl removal until
    // release so dragging a selected point can still move the group.
    if (range) onSelect(id, "range");
    else if (mode === "position" && alreadySelected) onSelect(id, false, true);
    else onSelect(id, additive);
    onBegin?.();
    drag.current = { id, mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false,
      toggleOnClick: additive && alreadySelected, collapseOnClick: mode === "position" && alreadySelected && !additive && !range };
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
  function snapped(svg: SVGSVGElement, point: { x: number; y: number }, id: string, bypass: boolean, creating = false) {
    if (!snap || bypass) { setGuides([]); return point; }
    // A new leg uses only its source as a point reference. Existing-point moves
    // can align with other points, excluding the group currently being moved.
    const other = creating ? points.filter(point => point.id === id)
      : [...points.filter(point => point.id !== id && !selectedIds.includes(point.id)), ...namedPoints.filter(point => !points.some(step => selectedIds.includes(step.id) && step.pointId === point.id))];
    const sourceIndex = points.findIndex(point => point.id === id);
    const result = snapPosition(point, {
      xs: [...other.map(point => ({ value: point.x, at: point.y, label: "Point X" })), ...[0, field.length / 2, field.length].map(value => ({ value, label: "Field X" }))],
      ys: [...other.map(point => ({ value: point.y, at: point.x, label: "Point Y" })), ...[0, field.width / 2, field.width].map(value => ({ value, label: "Field Y" }))],
      anchors: points.filter((point, index) => creating ? point.id === id : Math.abs(index - sourceIndex) === 1)
        .map(point => ({ point, label: "neighbor" })),
    }, 8 / (svg.getScreenCTM()?.a ? Math.abs(svg.getScreenCTM()!.a) : 1) / width * field.length, field);
    setGuides(result.guides);
    return { x: Math.max(0, Math.min(field.length, Math.round(result.point.x * 10000) / 10000)), y: Math.max(0, Math.min(field.width, Math.round(result.point.y * 10000) / 10000)) };
  }
  return <Box sx={{ flex: 1, minHeight: 220, display: "flex", flexDirection: "column", minWidth: 0,
    userSelect: "none", WebkitUserSelect: "none", "& svg, & svg *": { userSelect: "none", WebkitUserSelect: "none" },
    "& svg:focus, & svg *:focus": { outline: "none" } }}>
    <Box sx={{ flex: 1, minHeight: 200, border: "1px solid", borderColor: "divider", borderRadius: 1,
      bgcolor: "#0d1922", "& > svg": { width: "100%", height: "100%", minHeight: 200, display: "block", touchAction: "none" } }}>
      <FieldView dimensions={dimensions} layout={layout} flip={flip} pose={pose} labels padding={72}
        onPointerDown={event => {
          if (disabled || event.button !== 0) return;
          const point = coordinates(event.currentTarget, event.clientX, event.clientY, true); if (!point) return;
          event.preventDefault(); window.getSelection()?.removeAllRanges(); event.currentTarget.focus({ preventScroll: true });
          boxDrag.current = { start: point, pointerId: event.pointerId, additive: event.ctrlKey || event.shiftKey || event.metaKey, original: selectedIds };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const selection = boxDrag.current;
          if (selection && selection.pointerId === event.pointerId) {
            const point = coordinates(event.currentTarget, event.clientX, event.clientY, true);
            setBox(point && Math.hypot(point.x - selection.start.x, point.y - selection.start.y) > .05 ? { start: selection.start, end: point } : null);
            return;
          }
          const active = drag.current;
          if (!active || disabled || active.pointerId !== event.pointerId) return;
          if (active.mode !== "heading" && !active.moved) {
            if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 6) return;
            active.moved = true;
          }
          if (active.mode === "heading") {
            const step = points.find(step => step.id === active.id);
            const point = fieldCoordinates(event.currentTarget, event.clientX, event.clientY);
            if (step && point && Math.hypot(point.x - step.x, point.y - step.y) > 0.02) {
              const heading = normalizeHeading(Math.round(Math.atan2(point.y - step.y, point.x - step.x) * 180 / Math.PI));
              onHeading(step.id, snap && !event.ctrlKey ? snapHeading(heading, points.filter(point => point.id !== step.id).map(point => ({ value: point.heading, label: "Point heading" })), 4).heading : heading);
            }
          } else if (active.mode === "face") {
            const point = coordinates(event.currentTarget, event.clientX, event.clientY, true);
            if (point) onFace?.(active.id, snapped(event.currentTarget, point, active.id, event.ctrlKey));
          } else if (active.mode === "create") {
            const point = coordinates(event.currentTarget, event.clientX, event.clientY, true);
            if (point && points.some(step => step.id === active.id)) setPreview({ sourceId: active.id, ...snapped(event.currentTarget, point, active.id, event.ctrlKey, true) });
          } else {
            const point = coordinates(event.currentTarget, event.clientX, event.clientY, true); if (point) onMove(active.id, snapped(event.currentTarget, point, active.id, event.ctrlKey));
          }
        }} onPointerUp={event => {
          const selection = boxDrag.current;
          if (selection?.pointerId === event.pointerId) {
            if (box) {
              const found = points.filter(point => point.x >= Math.min(box.start.x, box.end.x) && point.x <= Math.max(box.start.x, box.end.x) && point.y >= Math.min(box.start.y, box.end.y) && point.y <= Math.max(box.start.y, box.end.y)).map(point => point.id);
              onSelection?.([...new Set([...(selection.additive ? selection.original : []), ...found])]);
            } else if (!selection.additive) onSelection?.([]);
            cancelDrag(); return;
          }
          const active = drag.current;
          if (!active || active.pointerId !== event.pointerId) return;
          cancelDrag();
          if (!disabled && active.mode === "position" && !active.moved && active.toggleOnClick) onSelect(active.id, true);
          else if (!disabled && !active.moved && active.collapseOnClick) onSelect(active.id);
          if (disabled || active.mode !== "create" || !active.moved) return;
          const source = points.find(step => step.id === active.id);
          const point = preview ?? coordinates(event.currentTarget, event.clientX, event.clientY, true);
          if (source && point && Math.hypot(point.x - source.x, point.y - source.y) >= 0.05) onAdd(source.id, point);
        }} onPointerCancel={() => cancelDrag(true)}
        onLostPointerCapture={() => { if (drag.current || boxDrag.current) cancelDrag(true); }}
        onKeyDown={event => { if (event.key === "Escape" && (drag.current || boxDrag.current)) { event.preventDefault(); cancelDrag(true); } }}>
        {box && (() => { const a = pixel(box.start), b = pixel(box.end); return <rect data-box-selection="true" x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} fill="#38bdf822" stroke="#38bdf8" pointerEvents="none" />; })()}
        {guides.map((guide, index) => { const a = pixel(guide.from), b = pixel(guide.to); return <line key={index} data-snap-guide="true" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" pointerEvents="none" />; })}
        {connectPoints && points.slice(1).map((step, index) => {
          const start = pixel(points[index]), end = pixel(step), selected = selectedIds.includes(step.id) || step.id === selectedId;
          return <line key={step.id} data-drive-leg={step.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
            stroke={selected ? "#fff" : "#facc15"} strokeWidth={selected ? 4 : 2} strokeDasharray="6 4" pointerEvents="none" />;
        })}
        {preview && points.some(step => step.id === preview.sourceId) && (() => {
          const source = pixel(points.find(step => step.id === preview.sourceId)!);
          const target = pixel(preview);
          return <g data-new-point-preview="true" pointerEvents="none">
            <path d={`M ${source.x} ${source.y} L ${target.x} ${target.y}`} stroke="#22c55e" strokeWidth="3" strokeDasharray="7 5" />
            <circle cx={target.x} cy={target.y} r="13" fill="#0d1922" stroke="#22c55e" strokeWidth="3" />
            <g transform={`translate(${target.x} ${target.y}) rotate(${-points.find(step => step.id === preview.sourceId)!.heading})`}>
              <RobotFootprint scale={height / field.width} stroke="#22c55e" fill="rgba(34,197,94,0.08)" />
            </g>
          </g>;
        })()}
        {points.filter(step => step.id === selectedId && step.turn.mode === "face").map(step => {
          if (step.turn.mode !== "face") return null;
          const target = pixel(step.turn), start = pixel(step);
          return <g key={`face-${step.id}`} data-face-target={step.id}>
            <line x1={start.x} y1={start.y} x2={target.x} y2={target.y} stroke="#38bdf8" strokeDasharray="3 3" pointerEvents="none" />
            <g transform={`translate(${target.x} ${target.y})`} role="button" aria-label="Facing target" style={{ cursor: "crosshair" }}
              onPointerDown={event => beginDrag(event, step.id, "face")}>
              <circle r="18" fill="transparent" /><circle r="9" fill="#0d1922" stroke="#38bdf8" strokeWidth="2" />
              <path d="M -14 0 H 14 M 0 -14 V 14" stroke="#38bdf8" strokeWidth="2" pointerEvents="none" />
            </g>
          </g>;
        })}
        {points.map((step, index) => {
          const p = pixel(step), selected = step.id === selectedId, marked = selected || selectedIds.includes(step.id);
          return <g key={step.id} data-auto-point={step.id} role="button" tabIndex={0} aria-label={pointNames ? `Named point ${pointNames[step.id]}` : `Drive point ${index + 1}`}
            transform={`translate(${p.x} ${p.y})`} style={{ cursor: disabled ? "default" : "grab" }}
            onPointerDown={event => beginDrag(event, step.id, "position")}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(step.id, event.shiftKey ? "range" : event.ctrlKey || event.metaKey); } }}>
            <title>{pointNames?.[step.id] ?? (index === 0 ? "Start point 1" : `Drive point ${index + 1}`)}</title>
            {selected && <g transform={`rotate(${-legEndHeading(step)})`} data-selected-point-footprint="true">
              <RobotFootprint scale={height / field.width} />
            </g>}
            <circle r="13" fill={marked ? "#facc15" : "#1e293b"} stroke="#facc15" strokeWidth="2" />
            <path d="M 14 0 H 27 M 21 -5 L 27 0 L 21 5" transform={`rotate(${-legEndHeading(step)})`} stroke={selected ? "#fff" : "#facc15"} fill="none" strokeWidth="2" pointerEvents="none" />
            {selected && step.turn.mode !== "face" && <g transform={`rotate(${-legEndHeading(step)})`}>
              <path d="M 27 0 H 48" stroke="#fff" strokeWidth="2" pointerEvents="none" />
              <g role="button" tabIndex={disabled ? -1 : 0} aria-label={`Heading for drive point ${index + 1}`} aria-disabled={disabled}
                data-heading-handle={step.id} transform="translate(48 0)" style={{ cursor: disabled ? "default" : "crosshair" }}
                onPointerDown={event => beginDrag(event, step.id, "heading")} onKeyDown={event => {
                  if (disabled || event.ctrlKey || event.metaKey || event.altKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                  event.stopPropagation();
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
            {allowCreation && selected && dragMode !== "heading" && dragMode !== "face" && <g transform={`rotate(${-legEndHeading(step)}) translate(0 44)`} aria-label={`Create point from drive point ${index + 1}`}
              data-add-point-handle={step.id} style={{ cursor: disabled ? "default" : "crosshair" }}
              onPointerDown={event => beginDrag(event, step.id, "create")}>
              <title>Drag + to create a point after this one. Escape cancels.</title>
              <circle r="18" fill="transparent" />
              <circle r="10" fill="#0d1922" stroke="#22c55e" strokeWidth="2" pointerEvents="none" />
              <path d="M -5 0 H 5 M 0 -5 V 5" stroke="#22c55e" strokeWidth="2" pointerEvents="none" />
            </g>}
            <text data-point-number={index + 1} x="0" y="0" fill={marked ? "#14212c" : "#facc15"} fontSize={index > 98 ? 9 : 12} fontWeight="700"
              textAnchor="middle" dominantBaseline="central" transform={flip ? "rotate(180)" : undefined} pointerEvents="none">{index + 1}</text>
          </g>;
        })}
        {connectPoints && <AutoSubpointMarkers points={points} pixel={pixel} scale={height / field.width} flip={flip} selectedIds={selectedIds} selectedId={selectedId} disabled={disabled} onSelect={onSelect} />}
      </FieldView>
    </Box>
  </Box>;
}
