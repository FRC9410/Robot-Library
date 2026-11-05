// What the Auto Builder draws at a moment: state colors, the replay robot, a leg's timing and the camera overlay.
import type { AutoStep, CameraMount } from "./autoModel";
import { legEndHeading } from "./autoModel";
import type { Replay } from "./autoReplay";
import { frameAt, loopPeriodSeconds, segmentAt, stateAt } from "./autoReplay";
import { isDrive } from "./autoRoute";
import type { RouteVision } from "./autoVision";
import { fixAt } from "./autoVision";
import { cameraColor } from "./cameraColors";
import type { FieldPose, LegReplayInfo, VisionOverlay } from "./types";

const stateColors = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#2dd4bf", "#f87171", "#fde047"];
/** Steps and route sections with no state requested, or a state the robot doesn't have. */
export const noStateColor = "#94a3b8";

/** Each StateMachine state gets a color, in the order the states are declared. */
export const stateColorFor = (states: string[]) => (state: string | null) => {
  const index = state === null ? -1 : states.indexOf(state);
  return index < 0 ? noStateColor : stateColors[index % stateColors.length];
};

/** The color a step shows in the list and on the timeline: its state for state steps. */
export const stepAccent = (step: AutoStep | undefined, stateColor: (state: string | null) => string) =>
  step && (step.type === "requestState" || step.type === "waitForState") ? stateColor(step.state) : undefined;

/** Where the replay is at `time` (null when stopped): the robot, the step running and the state requested. */
export function replayMoment(replay: Replay, time: number | null) {
  if (time === null) return { frame: undefined, pose: undefined, activeStepId: null, state: null };
  const frame = frameAt(replay, time);
  // The replay robot's wheels follow its direction of travel, taken from the next frame.
  const next = frameAt(replay, time + loopPeriodSeconds);
  const travel = frame && next && Math.hypot(next.x - frame.x, next.y - frame.y) > 1e-6
    ? Math.atan2(next.y - frame.y, next.x - frame.x) * 180 / Math.PI : undefined;
  const segment = segmentAt(replay, time);
  return {
    frame,
    pose: frame ? { x: frame.x, y: frame.y, heading: frame.heading, travel } as FieldPose : undefined,
    activeStepId: segment && segment.stepId !== "clear" ? segment.stepId : null,
    state: stateAt(replay, time)
  };
}

/** How the replay drives a drive step; undefined for other steps or steps the replay skips. */
export function legReplayInfo(replay: Replay, step: AutoStep | null, extraByStep?: Map<string, number>): LegReplayInfo | undefined {
  const segment = step ? replay.segments.find(candidate => candidate.stepId === step.id) : undefined;
  if (step?.type !== "drive" || !segment) return undefined;
  return {
    seconds: segment.end - segment.start,
    exitSpeed: frameAt(replay, segment.end)?.speed ?? 0,
    peakSpeed: Math.max(0, ...replay.frames.filter(frame => frame.t > segment.start && frame.t <= segment.end).map(frame => frame.speed)),
    robotExtraSeconds: extraByStep?.get(step.id),
    finished: !replay.unfinishedStepIds.includes(step.id)
  };
}

/** The pose the cameras are drawn at: the replay robot, else the live robot, else where the route starts. */
export function overlayPose(replayPose: FieldPose | undefined, livePose: FieldPose | undefined, route: AutoStep[]) {
  const start = route.find(isDrive);
  return replayPose ?? livePose ?? (start ? { x: start.x, y: start.y, heading: legEndHeading(start) } : null);
}

/** Camera wedges at the pose, and a line to every tag each camera can use there. */
export function cameraOverlay(vision: RouteVision | null, time: number, pose: FieldPose | null, cameras: CameraMount[],
  range: number): VisionOverlay | undefined {
  const sample = vision && fixAt(vision, time);
  if (!sample || !pose) return undefined;
  const heading = pose.heading * Math.PI / 180;
  return {
    cones: cameras.filter(camera => camera.enabled).map(camera => ({ id: camera.id, name: camera.name, color: cameraColor(cameras, camera.id),
      x: pose.x + camera.x * Math.cos(heading) - camera.y * Math.sin(heading),
      y: pose.y + camera.x * Math.sin(heading) + camera.y * Math.cos(heading),
      yaw: pose.heading + camera.yaw, hFov: camera.hFov, range })),
    lines: sample.fix.sightings.map(sighting => ({
      key: `${sighting.cameraId}-${sighting.tagId}`,
      color: cameraColor(cameras, sighting.cameraId),
      from: sighting.from, to: sighting.to,
      title: `${cameras.find(camera => camera.id === sighting.cameraId)?.name ?? "Camera"} sees tag ${sighting.tagId}: `
        + `${sighting.distance.toFixed(2)} m away, ${sighting.incidence.toFixed(0)}° off square, ${sighting.pixels.toFixed(0)} px across`
    }))
  };
}
