import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { DriveStep, NamedPoint } from "./autoModel";
import { legProgress } from "./autoReplay";
import { round } from "./autoModel";
import type { DragOverlayState, FieldDrag } from "./fieldDrag";
import { aimHeading, boxSelection, dragMoves, moveGroup, namedPointNear, snapPixels } from "./fieldDrag";
import type { FieldFrame } from "./fieldGeometry";
import { clampToField, metersPerPixel, pointerToField } from "./fieldGeometry";
import type { FieldSize, PointMove, SelectMode } from "./types";

export type FieldDragOptions = {
  svgRef: RefObject<SVGSVGElement | null>;
  frame: FieldFrame;
  field: FieldSize;
  /** The drive steps on the route shown, in route order. */
  drives: DriveStep[];
  points: NamedPoint[];
  selectedStepIds: string[];
  onSelectSteps: (stepIds: string[], mode: SelectMode) => void;
  onAddPoint: (x: number, y: number) => void;
  onMovePoints: (moves: PointMove[]) => void;
  onChangeHeading: (stepId: string, heading: number) => void;
  onChangeSubpoint?: (stepId: string, subpointId: string, progress: number) => void;
  onChangeFace?: (stepId: string, x: number, y: number, pointId: string | null) => void;
};

type Pointer = ReactPointerEvent<Element>;

/**
 * Pointer dragging on the Auto Builder field: click to add a point, drag to box-select, drag a robot
 * to move the selection, drag its handle to aim, and drag subpoints and face points. Hold Ctrl to
 * place freely; Shift-click toggles selection.
 */
export function useFieldDrag(options: FieldDragOptions) {
  const { svgRef, frame, field, drives, points, selectedStepIds, onSelectSteps } = options;
  const dragRef = useRef<FieldDrag | null>(null);
  const [overlay, setOverlay] = useState<DragOverlayState | null>(null);
  const toField = (event: { clientX: number; clientY: number }) => pointerToField(svgRef.current, frame, event);
  const threshold = () => snapPixels * metersPerPixel(svgRef.current, frame);

  const begin = (event: Pointer, drag: FieldDrag) => {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = drag;
  };
  const start = (event: Pointer) => ({ clientX: event.clientX, clientY: event.clientY, moved: false });

  const startSurface = (event: Pointer) => {
    const point = toField(event);
    if (!point || event.button !== 0) return;
    begin(event, { kind: "surface", ...start(event), start: point, additive: event.shiftKey });
  };
  const startMove = (event: Pointer, step: DriveStep) => {
    const additive = event.shiftKey;
    const { select, group } = moveGroup(step.id, selectedStepIds, additive);
    if (select) onSelectSteps([step.id], select);
    const ids = drives.filter(drive => group.includes(drive.id)).map(drive => drive.id);
    const grab = toField(event);
    if (!grab || !ids.includes(step.id)) { event.stopPropagation(); return; }
    begin(event, { kind: "move", ...start(event), stepId: step.id, ids, grab,
      origins: new Map(drives.filter(drive => ids.includes(drive.id)).map(drive => [drive.id, { x: drive.x, y: drive.y }])),
      reselect: !additive && selectedStepIds.includes(step.id) && selectedStepIds.length > 1 });
  };
  const startRotate = (event: Pointer, step: DriveStep) => {
    if (!selectedStepIds.includes(step.id)) onSelectSteps([step.id], "replace");
    begin(event, { kind: "rotate", ...start(event), stepId: step.id });
  };
  const startFace = (event: Pointer, stepId: string) => begin(event, { kind: "face", ...start(event), stepId });
  const startSubpoint = (event: Pointer, stepId: string, subpointId: string) => {
    onSelectSteps([stepId], "replace");
    begin(event, { kind: "subpoint", ...start(event), stepId, subpointId });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 4) return;
    drag.moved = true;
    const point = toField(event);
    if (!point) return;
    const snapping = !(event.ctrlKey || event.metaKey);
    const index = "stepId" in drag ? drives.findIndex(drive => drive.id === drag.stepId) : -1;

    if (drag.kind === "surface") {
      setOverlay({ guides: [], marquee: { a: drag.start, b: point } });
    } else if (drag.kind === "move") {
      const { moves, guides } = dragMoves(drives, drag, point, snapping, threshold(), field);
      options.onMovePoints(moves);
      setOverlay({ guides, hint: snapping ? "Hold Ctrl to place freely" : "Snapping off" });
    } else if (drag.kind === "rotate") {
      if (index < 0) return;
      const { heading, label } = aimHeading(drives, index, point, event.shiftKey, snapping);
      options.onChangeHeading(drag.stepId, heading);
      setOverlay({ guides: [], note: { at: point, text: label ?? `${heading}°` },
        hint: snapping ? "Ctrl: rotate freely · Shift: 15° steps" : "Snapping off" });
    } else if (drag.kind === "face") {
      // Dropping the face point near a named point links to it, such as the hub.
      const near = snapping ? namedPointNear(points, point, threshold()) : undefined;
      options.onChangeFace?.(drag.stepId, near ? near.x : round(clampToField(point.x, field.length)),
        near ? near.y : round(clampToField(point.y, field.width)), near?.id ?? null);
      setOverlay({ guides: [], note: near ? { at: { x: near.x, y: near.y }, text: `Face ${near.name}` } : undefined,
        hint: snapping ? "Drop on a named point to face it" : "Snapping off" });
    } else if (index > 0) {
      // Subpoints slide along the planned straight line from the previous point.
      options.onChangeSubpoint?.(drag.stepId, drag.subpointId, round(legProgress(drives[index - 1], point, drives[index])));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setOverlay(null);
    if (!drag) return;
    if (drag.kind === "surface") {
      const point = toField(event);
      if (!drag.moved) options.onAddPoint(round(clampToField(drag.start.x, field.length)), round(clampToField(drag.start.y, field.width)));
      else if (point) onSelectSteps(boxSelection(drives, drag.start, point), drag.additive ? "add" : "replace");
    } else if (drag.kind === "move" && !drag.moved && drag.reselect) {
      // Clicking one robot of a selection (without dragging) selects just that robot.
      onSelectSteps([drag.stepId], "replace");
    }
  };

  const onPointerCancel = () => { dragRef.current = null; setOverlay(null); };

  return { overlay, startSurface, startMove, startRotate, startFace, startSubpoint, onPointerMove, onPointerUp, onPointerCancel };
}
