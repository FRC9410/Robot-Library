import type { PointerEvent as ReactPointerEvent } from "react";
import type { DriveStep } from "../autoModel";
import { legEndHeading } from "../autoModel";
import type { FieldFrame } from "../fieldGeometry";
import { fieldColors } from "../fieldGeometry";
import type { RobotSize } from "../types";
import { FaceTarget } from "./FaceTarget";
import { HeadingHandle } from "./HeadingHandle";
import { RobotShape } from "./RobotShape";

type WaypointNodeProps = {
  step: DriveStep;
  frame: FieldFrame;
  robot: RobotSize;
  number: number;
  selected: boolean;
  /** Direction of travel into this point, for the wheels. */
  travel: number;
  /** Green for the first point, red for the last. */
  centerColor: string | null;
  /** The named point this step is linked to. */
  linkedName?: string;
  onPress: (event: ReactPointerEvent<SVGGElement>) => void;
  onAim: (event: ReactPointerEvent<SVGGElement>) => void;
  onMoveFace: (event: ReactPointerEvent<SVGGElement>) => void;
};

/** A drive point as a robot at its target pose: drag it to move, drag its handle to aim, drag the crosshair to change what it faces. */
export function WaypointNode({ step, frame, robot, number, selected, travel, centerColor, linkedName, onPress, onAim, onMoveFace }: WaypointNodeProps) {
  const { px, py, scale } = frame;
  const stroke = selected ? fieldColors.selected : fieldColors.node;
  const heading = legEndHeading(step);
  const facing = step.turn.mode === "face" ? step.turn : null;
  const front = robot.length * scale / 2;
  const primary = (handler: (event: ReactPointerEvent<SVGGElement>) => void) =>
    (event: ReactPointerEvent<SVGGElement>) => { if (event.button === 0) handler(event); };
  return <g className={`ab-node${selected ? " selected" : ""}`} transform={`translate(${px(step.x)} ${py(step.y)})`}>
    {facing && selected && <FaceTarget dx={px(facing.x) - px(step.x)} dy={py(facing.y) - py(step.y)} onPointerDown={primary(onMoveFace)} />}
    <g transform={`rotate(${-heading})`} onPointerDown={primary(onPress)}>
      <RobotShape robot={robot} scale={scale} heading={heading} travel={travel} stroke={stroke}
        fill={selected ? "rgba(250, 204, 21, 0.14)" : "rgba(11, 18, 32, 0.55)"} centerColor={centerColor} />
      {!facing && <HeadingHandle from={front} to={front + 0.32 * scale} stroke={stroke} onPointerDown={primary(onAim)} />}
    </g>
    <text className="ab-node-label" x={-front - 3} y={-robot.width * scale / 2 - 4}>{number}</text>
    {linkedName && <text className="ab-node-link" x={0} y={robot.width * scale / 2 + 14} textAnchor="middle">{linkedName}</text>}
  </g>;
}
