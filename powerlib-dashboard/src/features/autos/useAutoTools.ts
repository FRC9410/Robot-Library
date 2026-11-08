import { useEffect, useRef, useState } from "react";
import { cloneStep, editAuto, translateSteps, turnSteps, type FieldSize } from "./autoEditing";
import { allSteps, createId, deleteNamedPoint, filterSteps, insertStepsAt, locateStep, mapSteps, moveStepsInto, outermostSteps, routeSteps, setNamedPoint, shiftSteps, uniquePointName, type BranchArm, type BranchChoices, type InsertTarget, type ListRef, type AutoRoutine, type AutoStep, type NamedPoint } from "./autoModel";
import type { useAutoEditor } from "./useAutoEditor";
import { selectAutoSteps, type AutoSelectMode } from "./autoSelection";

export function useAutoTools(editor: ReturnType<typeof useAutoEditor>, auto: AutoRoutine | undefined, field: FieldSize, active = true) {
  const [ids, setIds] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"keys" | null>(null);
  const clipboard = useRef<AutoStep[]>([]);
  const [branches, setBranches] = useState<BranchChoices>({});
  const displayed = auto;
  const every = allSteps(auto?.steps ?? []);
  function showBranch(id: string, arm: BranchArm) { setBranches(previous => ({ ...previous, [id]: arm })); setIds([id]); }
  const route = auto ? { ...auto, steps: routeSteps(auto.steps, branches) } : undefined;
  const selected = ids.filter(id => every.some(step => step.id === id));
  const primary = selected.at(-1) ?? null;
  useEffect(() => { setIds([]); }, [auto?.id]);
  useEffect(() => window.powerlib?.onMenuAutoShortcuts?.(() => setDialog("keys")), []);
  function select(id: string, mode: AutoSelectMode = false, preserveGroup = false) {
    const place = auto && locateStep(auto.steps, id);
    if (place?.list) { const list = place.list; setBranches(previous => ({ ...previous, [list.branchId]: list.arm })); }
    setIds(previous => selectAutoSteps(every.map(step => step.id), previous, id, mode, preserveGroup));
  }
  function update(update: (auto: AutoRoutine) => AutoRoutine) {
    if (!auto || editor.readOnly) return;
    editor.setDocument(document => editAuto(document, auto.id, original => {
      const result = update(original);
      return { ...result, steps: mapSteps(result.steps, step => {
        const before = allSteps(original.steps).find(item => item.id === step.id);
        let source = step;
        if (!before && source.type === "drive" && source.turn.mode === "face" && source.turn.pointId) {
          const facing = source.turn, point = document.points.find(point => point.id === facing.pointId);
          source = { ...source, turn: point ? { ...facing, x: point.x, y: point.y } : { ...facing, pointId: null } };
        }
        if (!before && source.type === "drive" && source.pointId) {
          const point = document.points.find(point => point.id === source.pointId);
          return point ? { ...source, x: point.x, y: point.y, heading: point.heading } : { ...source, pointId: null };
        }
        return source;
      }) };
    }));
  }
  function change(step: AutoStep) { update(auto => ({ ...auto, steps: mapSteps(auto.steps, candidate => candidate.id === step.id ? step : candidate) })); }
  function translate(dx: number, dy: number) { update(auto => ({ ...auto, steps: translateSteps(auto.steps, selected, dx, dy, field) })); }
  function rotate(degrees: number) { update(auto => ({ ...auto, steps: turnSteps(auto.steps, selected, degrees) })); }
  function remove(removeIds = selected) { update(auto => ({ ...auto, steps: filterSteps(auto.steps, step => !removeIds.includes(step.id)) })); setIds(previous => previous.filter(id => !removeIds.includes(id))); }
  function copy() { clipboard.current = structuredClone(outermostSteps(displayed?.steps ?? [], selected)); }
  function duplicateStep(id: string) {
    if (!auto || editor.readOnly) return;
    const source = allSteps(auto.steps).find(step => step.id === id); if (!source) return;
    const copy = cloneStep(source);
    update(auto => ({ ...auto, steps: insertStepsAt(auto.steps, { after: id }, [copy]) }));
    setIds([copy.id]);
  }
  function paste(steps = clipboard.current) {
    if (!steps.length) return;
    const copies = steps.map(cloneStep);
    update(auto => ({ ...auto, steps: insertStepsAt(auto.steps, insertionTarget(), copies) }));
    setIds(copies.map(step => step.id));
  }
  function reorder(offset: -1 | 1) { update(auto => ({ ...auto, steps: shiftSteps(auto.steps, selected, offset) })); }
  function insertionTarget(after = primary): InsertTarget {
    const selected = every.find(step => step.id === after);
    return selected?.type === "branch" ? { into: { branchId: selected.id, arm: branches[selected.id] ?? "then" } } : { after };
  }
  function drop(source: string, target: string | null, list: ListRef = null) {
    if (!auto || !every.some(step => step.id === source)) return;
    const moving = selected.includes(source) ? selected : [source];
    const place = target ? locateStep(auto.steps, target) : null;
    const destination = place?.list ?? list;
    const items = destination ? (every.find(step => step.id === destination.branchId) as Extract<AutoStep, {type:"branch"}>)[destination.arm] : auto.steps;
    update(auto => ({ ...auto, steps: moveStepsInto(auto.steps, moving, destination, place?.index ?? items.length) }));
    setIds(moving);
    if (destination) setBranches(previous => ({ ...previous, [destination.branchId]: destination.arm }));
  }
  function savePoint() {
    const step = every.find(step => step.id === primary);
    if (step?.type !== "drive") return;
    const point: NamedPoint = { id: createId(), name: uniquePointName(editor.document), x: step.x, y: step.y, heading: step.heading };
    editor.setDocument(document => setNamedPoint({ ...document, autos: document.autos.map(candidate => candidate.id !== auto!.id ? candidate : {
      ...candidate, steps: mapSteps(candidate.steps, candidate => candidate.id === step.id ? { ...step, pointId: point.id } : candidate) }) }, point));
  }
  function link(pointId: string | null) {
    const point = editor.document.points.find(point => point.id === pointId);
    // Links are source-side coordinates, including while editing the reflected view.
    editor.setDocument(document => ({ ...document, autos: document.autos.map(candidate => candidate.id !== auto?.id ? candidate : {
      ...candidate, steps: mapSteps(candidate.steps, step => step.id === primary && step.type === "drive" ? { ...step, ...(point ? { x: point.x, y: point.y, heading: point.heading } : {}), pointId } : step) }) }));
  }
  function named(point: NamedPoint) { editor.setDocument(document => setNamedPoint(document, point)); }
  function deletePoint(id: string) { editor.setDocument(document => deleteNamedPoint(document, id)); }
  const actions = { copy, paste: () => paste(), duplicate: () => paste(outermostSteps(displayed?.steps ?? [], selected)),
    remove: () => remove(), up: () => reorder(-1), down: () => reorder(1), all: () => setIds(every.map(step => step.id)),
    undo: editor.history.undo, redo: editor.history.redo };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!active || event.defaultPrevented || dialog || editor.readOnly || !document.querySelector('[aria-label="Autos editor"]')?.getClientRects().length || document.querySelector('[role="dialog"], [role="menu"]')) return;
      const input = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (event.key === "Escape") { event.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); setIds([]); return; }
      if (command && key === "s") { event.preventDefault(); void editor.save(); return; }
      if (input) return;
      let action: (() => void) | undefined;
      if (command) action = ({ z: event.shiftKey ? actions.redo : actions.undo, y: actions.redo, c: actions.copy, v: actions.paste, d: actions.duplicate, a: actions.all } as Record<string, () => void>)[key];
      else if (event.altKey && event.key === "ArrowUp") action = actions.up;
      else if (event.altKey && event.key === "ArrowDown") action = actions.down;
      else if (["Delete", "Backspace"].includes(event.key)) action = actions.remove;
      else if (event.key === "Escape") action = () => setIds([]);
      else if (key === "?") action = () => setDialog("keys");
      else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) action = () => translate(
        event.key === "ArrowLeft" ? -(event.shiftKey ? .25 : .05) : event.key === "ArrowRight" ? event.shiftKey ? .25 : .05 : 0,
        event.key === "ArrowDown" ? -(event.shiftKey ? .25 : .05) : event.key === "ArrowUp" ? event.shiftKey ? .25 : .05 : 0);
      else if (key === "q" || key === "e") action = () => rotate((key === "q" ? 1 : -1) * (event.shiftKey ? 1 : 15));
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });
  return { ids: selected, primary, select, setIds, dialog, setDialog, displayed, route, branches, showBranch, insertionTarget, change, update,
    namedPoints: editor.document.points,
    translate, rotate, remove, actions, duplicateStep, drop, savePoint, link, named, deletePoint };
}
