import { indexAt } from "../logModel";
import type { Series } from "../logModel";
import { logColors } from "../logUtils";
import type { Pose } from "../wpilog";

type RobotPoseProps = {
  pose: Series<Pose>;
  time: number;
  fieldWidth: number;
  /** Seconds of path drawn behind the robot; 0 draws only the robot. */
  trailSeconds?: number;
};

/** The robot at `time`, with its recent path, drawn inside a FieldCanvas. Faded when the pose is over 1 s old. */
export function RobotPose({ pose, time, fieldWidth, trailSeconds = 3 }: RobotPoseProps) {
  const index = indexAt(pose.times, time);
  if (index < 0) return null;
  const current = pose.values[index];
  const first = Math.max(0, indexAt(pose.times, time - trailSeconds));
  const trail = trailSeconds > 0 ? pose.values.slice(first, index + 1) : [];
  const stride = Math.max(1, Math.ceil(trail.length / 300));
  const points = trail.filter((_, sample) => sample % stride === 0 || sample === trail.length - 1)
    .map(sample => `${sample.x.toFixed(2)},${(fieldWidth - sample.y).toFixed(2)}`).join(" ");
  const stale = time - pose.times[index] > 1;
  return (
    <>
      {points && <polyline points={points} fill="none" stroke={logColors.trail} strokeWidth={0.07} strokeLinejoin="round" />}
      <g transform={`translate(${current.x} ${fieldWidth - current.y}) rotate(${(-current.heading * 180) / Math.PI})`} opacity={stale ? 0.4 : 1}>
        <rect x={-0.4} y={-0.4} width={0.8} height={0.8} rx={0.08} fill="rgba(250,204,21,0.15)" stroke={logColors.value} strokeWidth={0.07} />
        <line x1={0} y1={0} x2={0.55} y2={0} stroke={logColors.value} strokeWidth={0.07} />
      </g>
    </>
  );
}
