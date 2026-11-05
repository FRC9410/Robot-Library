import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { RobotLimit, Replay, ReplaySegment } from "../autoReplay";
import { stateAt } from "../autoReplay";
import type { RouteVision } from "../autoVision";
import type { RobotCheck } from "../types";
import { VisionStrip } from "./VisionStrip";

const strainTitles: Record<RobotLimit, string> = {
  speed: "Close to top speed: the robot falls behind the replay here",
  acceleration: "The robot can't speed up or slow down this hard here",
  turn: "Turning uses up wheel speed here, so the robot slows down"
};

type ReplayTimelineProps = {
  replay: Replay;
  time: number | null;
  /** Autonomous period in seconds; the timeline always shows it so overruns are obvious. */
  period: number;
  activeStepId: string | null;
  stateColor: (state: string | null) => string;
  /** Color for a non-drive step, matching the step list (its state for state steps). */
  stepColor: (stepId: string) => string | undefined;
  /** The step's number in the step list; its place in the replay when missing. */
  stepNumber: (stepId: string) => number | undefined;
  robotCheck?: RobotCheck;
  vision?: RouteVision;
  onSeek: (time: number) => void;
  onSelectStep: (stepId: string) => void;
};

/**
 * The auto over time: a block per step (drive legs colored by the state requested), subpoint
 * diamonds, where the drivetrain falls behind, the period limit and the playhead. Drag to scrub.
 */
export function ReplayTimeline({ replay, time, period, activeStepId, stateColor, stepColor, stepNumber, robotCheck, vision, onSeek, onSelectStep }: ReplayTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scale = Math.max(replay.duration, period);
  const percent = (seconds: number) => `${seconds / scale * 100}%`;
  const empty = replay.frames.length === 0;

  /** A drive leg's colors over time, split where a subpoint changes the requested state (same as the field route). */
  const statePieces = (start: number, end: number) => {
    const cuts = [start, ...replay.stateChanges.map(change => change.t).filter(t => t > start && t < end), end];
    const stops = cuts.slice(0, -1).flatMap((from, index) => {
      const color = stateColor(stateAt(replay, from));
      return [`${color} ${(from - start) / (end - start) * 100}%`, `${color} ${(cuts[index + 1] - start) / (end - start) * 100}%`];
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  };
  const background = (segment: ReplaySegment) => {
    if (segment.type === "drive") return statePieces(segment.start, segment.end);
    const color = stepColor(segment.stepId);
    return segment.type === "waitForState" && color ? `repeating-linear-gradient(135deg, ${color} 0 4px, #3f3f46 4px 8px)` : color;
  };
  const seekFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || empty) return;
    onSeek(Math.min(replay.duration, Math.max(0, (event.clientX - box.left) / box.width * scale)));
  };

  return <div className="ab-timeline-wrap">
    {/* Total time sits above the end of the last step. */}
    {!empty && <span className={`ab-timeline-total${replay.duration > period ? " over" : ""}`}
      style={{ left: percent(replay.duration), transform: replay.duration / scale > 0.1 ? "translateX(-100%)" : undefined }}>{replay.duration.toFixed(1)} s</span>}
    <div ref={trackRef} className={`ab-timeline${empty ? " empty" : ""}`} role="slider" aria-label="Replay time"
      aria-valuemin={0} aria-valuemax={replay.duration} aria-valuenow={time ?? 0}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); seekFromPointer(event); }}
      onPointerMove={event => { if (event.buttons & 1) seekFromPointer(event); }}>
      {replay.segments.map(segment => <div key={`${segment.stepId}-${segment.start}`}
        className={`ab-timeline-block ${segment.type}${segment.stepId === activeStepId ? " active" : ""}`}
        title={`${segment.type === "clearRequests" ? "Clear state requests" : `Step ${stepNumber(segment.stepId) ?? segment.stepIndex + 1}`}: ${(segment.end - segment.start).toFixed(2)} s`}
        style={{ left: percent(segment.start), width: percent(segment.end - segment.start), background: background(segment) }}
        onDoubleClick={() => segment.stepId !== "clear" && onSelectStep(segment.stepId)} />)}
      {replay.stateChanges.filter(change => change.subpointId).map(change => <div key={change.subpointId}
        className="ab-timeline-tick" style={{ left: percent(change.t), background: stateColor(change.state) }}
        title={`${change.state} requested at ${change.t.toFixed(2)} s`} />)}
      {robotCheck?.strain.map(range => <div key={`${range.stepId}-${range.limit}-${range.start}`} className="ab-timeline-strain"
        style={{ left: percent(range.start), width: percent(range.end - range.start) }} title={strainTitles[range.limit]} />)}
      <div className="ab-timeline-limit" style={{ left: percent(period) }} title={`${period} s autonomous period`} />
      {time !== null && <div className="ab-timeline-head" style={{ left: percent(time) }} />}
    </div>
    {vision && vision.spans.length > 0 && <VisionStrip vision={vision} percent={percent} />}
  </div>;
}
