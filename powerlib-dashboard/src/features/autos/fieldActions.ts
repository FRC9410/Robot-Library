// Edits made on the field. In the mirrored view they are flipped back onto the original auto.
import type { DriveStep } from "./autoModel";
import { allSteps, flipPoint } from "./autoModel";
import { applyPointPatches, nudgeChanges, pointPatches, subpointProgressIn } from "./autoEdits";
import type { EditorContext } from "./editorContext";
import type { StepActions } from "./stepActions";
import type { FieldPoint, PointChange, PointMove } from "./types";

export function fieldActions(ctx: EditorContext, steps: StepActions) {
  const { auto, mirror, viewingMirror, field } = ctx;
  const shownAuto = viewingMirror ? mirror : auto;
  /** A point as the original auto has it. */
  const original = (point: FieldPoint) => viewingMirror && auto ? flipPoint({ ...point, heading: 0 }, auto.symmetry, field) : point;

  /** Applies field edits to several drive points at once. */
  const changePoints = (changes: PointChange[], key: string) => {
    if (!auto || !shownAuto) return;
    const patches = pointPatches(changes, shownAuto.steps, viewingMirror ? auto.symmetry : null, field);
    steps.updateSelected(current => ({ ...current, steps: applyPointPatches(current.steps, patches) }), key);
  };
  const addPoint = (x: number, y: number) => {
    if (auto) steps.insertSteps([steps.newDrive(steps.defaultTarget(), original({ x, y }))]);
  };

  return {
    addPoint,
    /** A drive point at the robot's live position, to the centimeter. */
    addPointAt: (pose: FieldPoint) => addPoint(Math.round(pose.x * 100) / 100, Math.round(pose.y * 100) / 100),
    movePoints: (moves: PointMove[]) => changePoints(moves, `move:${moves.map(move => move.stepId).join(",")}`),
    changeHeading: (stepId: string, heading: number) => {
      const key = `point:${stepId}:heading`;
      if (!viewingMirror || !auto || !mirror) { steps.updateStep(stepId, { heading }, key); return; }
      const shown = allSteps(mirror.steps).find((step): step is DriveStep => step.id === stepId && step.type === "drive");
      if (!shown) return;
      const flipped = flipPoint({ ...shown, heading }, auto.symmetry, field);
      steps.updateStep(stepId, { x: flipped.x, y: flipped.y, heading: flipped.heading }, key);
    },
    /** Moves the point a leg faces. */
    changeFace: (stepId: string, x: number, y: number, pointId: string | null) => {
      const point = original({ x, y });
      steps.updateStep(stepId, { turn: { mode: "face", x: point.x, y: point.y, pointId } }, `face:${stepId}`);
    },
    // Subpoint progress is a fraction of the leg, so it is the same in the mirrored view.
    changeSubpoint: (stepId: string, subpointId: string, progress: number) =>
      steps.updateSelected(current => ({ ...current, steps: subpointProgressIn(current.steps, stepId, subpointId, progress) }), `subpoint:${subpointId}`),
    /** Moves or turns the selected drive points in the frame shown on the field. */
    nudgeSelected: (dx: number, dy: number, turn: number) => {
      const changes = nudgeChanges(shownAuto?.steps ?? [], ctx.selection, dx, dy, turn, field);
      if (changes.length) changePoints(changes, `nudge:${changes.map(change => change.stepId).join(",")}:${turn !== 0 ? "turn" : "move"}`);
    }
  };
}

export type FieldActions = ReturnType<typeof fieldActions>;
