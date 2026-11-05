// Named points: poses saved once and reused across autos; moving one moves each step linked to it.
import type { DriveStep, NamedPoint } from "./autoModel";
import { createId, deleteNamedPoint, setNamedPoint, uniquePointName } from "./autoModel";
import { linkStepToPoint, renamePointIn } from "./autoEdits";
import type { EditorContext } from "./editorContext";
import type { StepActions } from "./stepActions";

export function pointActions(ctx: EditorContext, steps: StepActions) {
  const { document, change } = ctx;
  const find = (pointId: string | null) => pointId === null ? undefined : document.points.find(point => point.id === pointId);

  return {
    /** A drive step to a named point, linked so it follows the point. */
    driveTo: (pointId: string) => {
      const point = find(pointId);
      if (point && ctx.auto) steps.insertSteps([{ ...steps.newDrive(steps.defaultTarget(), point), heading: point.heading, pointId: point.id }]);
    },
    /** Links a step to a point (taking its pose), or unlinks it with null. */
    link: (stepId: string, pointId: string | null) => {
      const point = find(pointId);
      steps.updateStep(stepId, point ? { x: point.x, y: point.y, heading: point.heading, pointId: point.id } : { pointId: null });
    },
    /** Saves a drive step's pose as a new named point and links the step to it. */
    saveFrom: (step: DriveStep) => {
      const point: NamedPoint = { id: createId(), name: uniquePointName(document), x: step.x, y: step.y, heading: step.heading };
      change(current => setNamedPoint(linkStepToPoint(current, step.id, point), point));
    },
    rename: (pointId: string, name: string) => change(current => renamePointIn(current, pointId, name), `point-name:${pointId}`),
    remove: (point: NamedPoint) => {
      change(current => deleteNamedPoint(current, point.id));
      ctx.notify({ severity: "info", text: `Deleted "${point.name}". Steps that used it keep their spot. Press Ctrl+Z to undo.` });
    }
  };
}

export type PointActions = ReturnType<typeof pointActions>;
