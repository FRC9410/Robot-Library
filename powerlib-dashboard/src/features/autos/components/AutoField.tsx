import { useRef } from "react";
import { FieldBackdrop } from "../../field/components/FieldBackdrop";
import type { FieldLayout } from "../../field/fieldLayouts";
import type { ActualPoint } from "../autoActual";
import type { AutoRoutine, NamedPoint } from "../autoModel";
import type { Replay } from "../autoReplay";
import { isDrive } from "../autoRoute";
import { fieldColors, fieldFrame, fieldPrompt, legTravel, subpointMarks } from "../fieldGeometry";
import type { FieldPose, FieldSize, GhostRoute, PointMove, RobotSize, SelectMode, VisionOverlay } from "../types";
import { useFieldDrag } from "../useFieldDrag";
import { ActualRunPath } from "./ActualRunPath";
import { BranchGhost } from "./BranchGhost";
import { CameraCoverage } from "./CameraCoverage";
import { DragOverlay } from "./DragOverlay";
import { FieldGridBackdrop } from "./FieldGridBackdrop";
import { FieldPrompt } from "./FieldPrompt";
import { NamedPointPin } from "./NamedPointPin";
import { PlannedRoute } from "./PlannedRoute";
import { RobotShape } from "./RobotShape";
import { SubpointMarker } from "./SubpointMarker";
import { WaypointNode } from "./WaypointNode";

type AutoFieldProps = {
  /** The auto as the field shows it: one route, each branch followed by the side picked for it. */
  auto: AutoRoutine | null;
  field: FieldSize;
  layout: FieldLayout | null;
  robot: RobotSize;
  stateColor: (state: string | null) => string;
  selectedStepIds: string[];
  /** The ideal motion, drawn as the robot's route. */
  replay?: Replay;
  /** The live or replay robot. */
  pose?: FieldPose;
  onSelectSteps: (stepIds: string[], mode: SelectMode) => void;
  onAddPoint: (x: number, y: number) => void;
  onMovePoints: (moves: PointMove[]) => void;
  onChangeHeading: (stepId: string, heading: number) => void;
  /** Moves a subpoint along its leg; progress is 0 to 1. */
  onChangeSubpoint?: (stepId: string, subpointId: string, progress: number) => void;
  /** While replaying, every waypoint stays soft so the moving robot stands out. */
  replaying?: boolean;
  /** Named points; the ones this auto doesn't use show as pins that add a linked step. */
  points?: NamedPoint[];
  onAddFromPoint?: (pointId: string) => void;
  /** Moves the point a leg faces; `pointId` is set when it snapped onto a named point. */
  onChangeFace?: (stepId: string, x: number, y: number, pointId: string | null) => void;
  /** Where the robot actually went the last time it ran this auto. */
  actual?: ActualPoint[];
  /** Point numbers by step id, counted over every drive step (both sides of each branch); route order when missing. */
  driveNumbers?: Map<string, number>;
  /** The sides of branches the field isn't showing, drawn faintly; click one of their points to show that side. */
  ghosts?: GhostRoute[];
  /** Camera coverage at the pose being shown; left out when the tag view is off. */
  vision?: VisionOverlay;
};

/**
 * Field view in the blue-origin frame. Click to add a point, drag to box-select, drag a robot to
 * move it (the whole selection moves together), drag its handle to aim. Positions snap to other
 * points' X/Y and to 45° lines from neighbors; headings snap to 45° steps and nearby headings.
 */
export function AutoField({ auto, field, layout, robot, stateColor, selectedStepIds, replay, pose, onSelectSteps, onAddPoint, onMovePoints,
  onChangeHeading, onChangeSubpoint, replaying = false, points = [], onAddFromPoint, onChangeFace, actual, driveNumbers, ghosts = [], vision }: AutoFieldProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frame = fieldFrame(field);
  const drives = (auto?.steps ?? []).filter(isDrive);
  const selected = new Set(selectedStepIds);
  const drag = useFieldDrag({ svgRef, frame, field, drives, points, selectedStepIds, onSelectSteps, onAddPoint, onMovePoints,
    onChangeHeading, onChangeSubpoint, onChangeFace });
  const prompt = fieldPrompt(drives.length, selectedStepIds.length);
  // Selected robots draw last, so they and their handles sit on top of overlapping robots.
  const nodes = drives.map((step, index) => ({ step, index })).sort((a, b) => Number(selected.has(a.step.id)) - Number(selected.has(b.step.id)));

  return (
    <svg ref={svgRef} className={`auto-field${replaying ? " replaying" : ""}`} viewBox={`-14 -14 ${frame.width + 28} ${frame.height + 28}`}
      role="img" aria-label="Auto path on the field" preserveAspectRatio="xMidYMid meet"
      onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerCancel}>
      <rect className="auto-field-surface" width={frame.width} height={frame.height} rx="5" fill="#101e29" stroke="#7993a5" strokeWidth="3"
        onPointerDown={event => { if (auto) drag.startSurface(event); }} />
      <g className="ab-backdrop">
        {layout ? <FieldBackdrop layout={layout} width={frame.width} height={frame.height} labels /> : <FieldGridBackdrop frame={frame} />}
      </g>
      {vision && <CameraCoverage vision={vision} frame={frame} />}
      <PlannedRoute drives={drives} replay={replay} frame={frame} stateColor={stateColor} />
      {ghosts.map((ghost, index) => <BranchGhost key={index} ghost={ghost} frame={frame} driveNumbers={driveNumbers}
        onPick={stepId => onSelectSteps([stepId], "replace")} />)}
      {actual && <ActualRunPath points={actual} frame={frame} />}
      {onAddFromPoint && points.filter(point => !drives.some(step => step.pointId === point.id)).map(point =>
        <NamedPointPin key={point.id} point={point} frame={frame} onAdd={onAddFromPoint} />)}
      {subpointMarks(replay, frame).map(mark => <SubpointMarker key={mark.subpointId} mark={mark} color={stateColor(mark.state)}
        onPointerDown={event => drag.startSubpoint(event, mark.stepId, mark.subpointId)} />)}
      {nodes.map(({ step, index }) => <WaypointNode key={step.id} step={step} frame={frame} robot={robot}
        number={driveNumbers?.get(step.id) ?? index + 1} selected={selected.has(step.id)} travel={legTravel(drives, index)}
        centerColor={index === 0 ? fieldColors.start : index === drives.length - 1 ? fieldColors.end : null}
        linkedName={step.pointId ? points.find(point => point.id === step.pointId)?.name : undefined}
        onPress={event => drag.startMove(event, step)} onAim={event => drag.startRotate(event, step)} onMoveFace={event => drag.startFace(event, step.id)} />)}
      {pose && <g transform={`translate(${frame.px(pose.x)} ${frame.py(pose.y)}) rotate(${-pose.heading})`} pointerEvents="none">
        <RobotShape robot={robot} scale={frame.scale} heading={pose.heading} travel={pose.travel ?? pose.heading}
          stroke={fieldColors.selected} fill="rgba(250, 204, 21, 0.3)" centerColor={null} />
      </g>}
      {drag.overlay && <DragOverlay overlay={drag.overlay} frame={frame} />}
      {!auto && <text x={frame.width / 2} y={frame.height / 2} textAnchor="middle" fill="#a8bbca" fontSize="22">Create or pick an auto to start</text>}
      {auto && prompt && <FieldPrompt text={prompt} width={frame.width} />}
    </svg>
  );
}
