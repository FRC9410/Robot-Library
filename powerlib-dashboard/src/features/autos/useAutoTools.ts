import { useEffect, useRef, useState } from "react";
import { cloneStep, editAuto, reorderStepsBefore, translateSteps, turnSteps, type FieldSize } from "./autoEditing";
import { createId, deleteNamedPoint, setNamedPoint, shiftSteps, uniquePointName, type AutoRoutine, type AutoStep, type NamedPoint } from "./autoModel";
import type { useAutoEditor } from "./useAutoEditor";
import { selectAutoSteps, type AutoSelectMode } from "./autoSelection";

export function useAutoTools(editor: ReturnType<typeof useAutoEditor>, auto: AutoRoutine | undefined, field: FieldSize, active = true) {
  const [ids, setIds] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"keys" | null>(null);
  const clipboard = useRef<AutoStep[]>([]);
  const displayed = auto;
  const selected = ids.filter(id => auto?.steps.some(step => step.id === id));
  const primary = selected.at(-1) ?? null;
  useEffect(() => { setIds([]); }, [auto?.id]);
  useEffect(() => window.powerlib?.onMenuAutoShortcuts?.(() => setDialog("keys")), []);
  function select(id: string, mode: AutoSelectMode = false, preserveGroup = false) {
    setIds(previous => selectAutoSteps(auto?.steps.map(step => step.id) ?? [], previous, id, mode, preserveGroup));
  }
  function update(update: (auto: AutoRoutine) => AutoRoutine) {
    if (!auto || editor.readOnly) return;
    editor.setDocument(document => editAuto(document, auto.id, original => {
      const result = update(original);
      return { ...result, steps: result.steps.map(step => {
        const before = original.steps.find(item => item.id === step.id);
        const source = step;
        if (!before && source.type === "drive" && source.pointId) {
          const point = document.points.find(point => point.id === source.pointId);
          return point ? { ...source, x: point.x, y: point.y, heading: point.heading } : { ...source, pointId: null };
        }
        return source;
      }) };
    }));
  }
  function change(step: AutoStep) { update(auto => ({ ...auto, steps: auto.steps.map(candidate => candidate.id === step.id ? step : candidate) })); }
  function translate(dx: number, dy: number) { update(auto => ({ ...auto, steps: translateSteps(auto.steps, selected, dx, dy, field) })); }
  function rotate(degrees: number) { update(auto => ({ ...auto, steps: turnSteps(auto.steps, selected, degrees) })); }
  function remove(removeIds = selected) { update(auto => ({ ...auto, steps: auto.steps.filter(step => !removeIds.includes(step.id)) })); setIds(previous => previous.filter(id => !removeIds.includes(id))); }
  function copy() { clipboard.current = structuredClone(displayed?.steps.filter(step => selected.includes(step.id)) ?? []); }
  function duplicateStep(id: string) {
    if (!auto || editor.readOnly) return;
    const source = auto.steps.find(step => step.id === id); if (!source) return;
    const copy = cloneStep(source);
    update(auto => { const steps = [...auto.steps], index = steps.findIndex(step => step.id === id); steps.splice(index + 1, 0, copy); return { ...auto, steps }; });
    setIds([copy.id]);
  }
  function paste(steps = clipboard.current) {
    if (!steps.length) return;
    const copies = steps.map(cloneStep);
    update(auto => { const steps = [...auto.steps], index = steps.findIndex(step => step.id === primary); steps.splice(index < 0 ? steps.length : index + 1, 0, ...copies); return { ...auto, steps }; });
    setIds(copies.map(step => step.id));
  }
  function reorder(offset: -1 | 1) { update(auto => ({ ...auto, steps: shiftSteps(auto.steps, selected, offset) })); }
  function drop(source: string, target: string | null) {
    if (!auto?.steps.some(step => step.id === source)) return;
    const moving = selected.includes(source) ? selected : [source];
    update(auto => ({ ...auto, steps: reorderStepsBefore(auto.steps, moving, target) }));
    setIds(moving);
  }
  function savePoint() {
    const step = auto?.steps.find(step => step.id === primary);
    if (step?.type !== "drive") return;
    const point: NamedPoint = { id: createId(), name: uniquePointName(editor.document), x: step.x, y: step.y, heading: step.heading };
    editor.setDocument(document => setNamedPoint({ ...document, autos: document.autos.map(candidate => candidate.id !== auto!.id ? candidate : {
      ...candidate, steps: candidate.steps.map(candidate => candidate.id === step.id ? { ...step, pointId: point.id } : candidate) }) }, point));
  }
  function link(pointId: string | null) {
    const point = editor.document.points.find(point => point.id === pointId);
    // Links are source-side coordinates, including while editing the reflected view.
    editor.setDocument(document => ({ ...document, autos: document.autos.map(candidate => candidate.id !== auto?.id ? candidate : {
      ...candidate, steps: candidate.steps.map(step => step.id === primary && step.type === "drive" ? { ...step, ...(point ? { x: point.x, y: point.y, heading: point.heading } : {}), pointId } : step) }) }));
  }
  function named(point: NamedPoint) { editor.setDocument(document => setNamedPoint(document, point)); }
  function deletePoint(id: string) { editor.setDocument(document => deleteNamedPoint(document, id)); }
  const actions = { copy, paste: () => paste(), duplicate: () => paste(displayed?.steps.filter(step => selected.includes(step.id)) ?? []),
    remove: () => remove(), up: () => reorder(-1), down: () => reorder(1), all: () => setIds(auto?.steps.map(step => step.id) ?? []),
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
  return { ids: selected, primary, select, setIds, dialog, setDialog, displayed, change, update,
    namedPoints: editor.document.points,
    translate, rotate, remove, actions, duplicateStep, drop, savePoint, link, named, deletePoint };
}
