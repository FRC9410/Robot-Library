import { Chip } from "@mui/material";
import type { Replay } from "../autoReplay";
import type { RouteVision } from "../autoVision";
import type { ReplayPlayback } from "../useReplayPlayback";
import type { RobotCheck } from "../types";
import { PeriodLabel } from "./PeriodLabel";
import { ReplayControls } from "./ReplayControls";
import { ReplaySpeedSelect } from "./ReplaySpeedSelect";
import { ReplayTimeline } from "./ReplayTimeline";
import { RobotCheckChip } from "./RobotCheckChip";
import { TagCoverageChip } from "./TagCoverageChip";

type AutoReplayBarProps = {
  replay: Replay;
  playback: ReplayPlayback;
  activeStepId: string | null;
  /** Autonomous period in seconds. */
  period: number;
  stateColor: (state: string | null) => string;
  stepColor: (stepId: string) => string | undefined;
  stepNumber: (stepId: string) => number | undefined;
  /** Set when the robot project's drivetrain is known. */
  robotCheck?: RobotCheck;
  /** AprilTag coverage along the route; set when the tag view is on and a camera is set up. */
  vision?: RouteVision;
  onPeriod: (seconds: number) => void;
  onSelectStep: (stepId: string) => void;
};

/** Under the field: replay controls, the timeline, and what the replay found. */
export function AutoReplayBar({ replay, playback, activeStepId, period, stateColor, stepColor, stepNumber, robotCheck, vision, onPeriod, onSelectStep }: AutoReplayBarProps) {
  const unfinished = replay.unfinishedStepIds.length;
  return <div className="ab-replay">
    <ReplayControls time={playback.time} playing={playback.playing} empty={replay.frames.length === 0}
      onPlay={playback.play} onPause={playback.pause} onStop={playback.stop} />
    <ReplayTimeline replay={replay} time={playback.time} period={period} activeStepId={activeStepId} stateColor={stateColor} stepColor={stepColor}
      stepNumber={stepNumber} robotCheck={robotCheck} vision={vision} onSeek={playback.seek} onSelectStep={onSelectStep} />
    {replay.duration > period && <Chip size="small" color="error" variant="outlined" label={`Over ${period} s`} />}
    {robotCheck && <RobotCheckChip check={robotCheck} period={period} />}
    {vision && vision.spans.length > 0 && <TagCoverageChip vision={vision} />}
    <PeriodLabel period={period} onChange={onPeriod} />
    {unfinished > 0 && <Chip size="small" color="warning" variant="outlined" label={`${unfinished} leg${unfinished === 1 ? "" : "s"} never finish`} />}
    <ReplaySpeedSelect value={playback.speed} onChange={playback.setSpeed} />
  </div>;
}
