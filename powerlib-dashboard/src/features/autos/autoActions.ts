// Editing whole autos: create, duplicate, delete, flip, and the selected auto's own settings.
import type { Alliance, CameraMount, Symmetry } from "./autoModel";
import { createAuto, flipSteps } from "./autoModel";
import { duplicateAuto, insertAutoAfter, nextAutoName, setDefaultIn } from "./autoEdits";
import type { EditorContext } from "./editorContext";
import type { StepActions } from "./stepActions";

export function autoActions(ctx: EditorContext, steps: StepActions) {
  const { document, change, auto, selectAuto } = ctx;
  const named = (id: string) => document.autos.find(candidate => candidate.id === id);

  // These take an auto id so the list's right-click menu can act on any auto.
  return {
    create: () => {
      const next = createAuto(nextAutoName(document.autos));
      change(current => ({ ...current, autos: [...current.autos, next] }));
      selectAuto(next.id);
    },
    duplicate: (id: string) => {
      const source = named(id);
      if (!source) return;
      const { copy, branchPairs } = duplicateAuto(source);
      // The copy's branches have new ids; show the same sides as the original.
      branchPairs.forEach(([sourceId, copyId]) => ctx.showArm(copyId, ctx.choices[sourceId] ?? "then"));
      change(current => insertAutoAfter(current, id, copy));
      selectAuto(copy.id);
    },
    remove: (id: string) => {
      const source = named(id);
      if (!source) return;
      const remaining = document.autos.filter(candidate => candidate.id !== id);
      change(current => ({ ...current, autos: current.autos.filter(candidate => candidate.id !== id) }));
      if (id === ctx.selectedAutoId) selectAuto(remaining[0]?.id ?? null);
      ctx.notify({ severity: "info", text: `Deleted "${source.name || "(unnamed)"}". Press Ctrl+Z to undo.` });
    },
    setDefault: (id: string, checked: boolean) => change(current => setDefaultIn(current, id, checked)),
    flip: (id: string, flips: Symmetry) => steps.updateAuto(id, current => ({ ...current, steps: flipSteps(current.steps, flips, ctx.field) })),
    toggleClearRequests: (id: string) => steps.updateAuto(id, current => ({ ...current, clearRequestsAtEnd: !current.clearRequestsAtEnd })),
    rename: (name: string) => { if (auto) steps.updateSelected(current => ({ ...current, name }), `name:${auto.id}`); },
    setAlliance: (alliance: Alliance | null) => steps.updateSelected(current => ({ ...current, alliance })),
    setSymmetry: (symmetry: Symmetry) => steps.updateSelected(current => ({ ...current, symmetry })),
    setPeriod: (seconds: number) => change(current => ({ ...current, periodSeconds: seconds })),
    setCameras: (cameras: CameraMount[]) => change(current => ({ ...current, cameras }), "cameras")
  };
}

export type AutoActions = ReturnType<typeof autoActions>;
