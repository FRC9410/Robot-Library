// Records where the robot actually went while it ran an auto, to draw over the ideal route.

export type ActualPoint = { t: number; x: number; y: number; heading: number };
/** One run of an auto; `seconds` is from the start of autonomous to the robot's last movement. */
export type ActualRun = { autoName: string; recordedAt: number; seconds: number; points: ActualPoint[] };

export type TelemetrySample = {
  /** Milliseconds, such as Date.now(). */
  time: number;
  /** DriveTelemetry's Mode: DISABLED, AUTO, TELEOP or TEST. */
  mode: string | undefined;
  enabled: boolean | undefined;
  /** The auto chooser's active selection. */
  autoName: string | undefined;
  pose: { x: number; y: number; heading: number } | undefined;
};

/** Small moves are skipped so long runs stay light. */
const minimumStepMeters = 0.02;
const minimumTurnDegrees = 2;
const maxPoints = 4000;

/** Turns a stream of telemetry samples into runs; one run per enabled autonomous period. */
export class RunRecorder {
  private run: ActualRun | null = null;
  private startedAt = 0;

  /** Returns the run being recorded (null when not recording) and whether it just ended. */
  update(sample: TelemetrySample): { run: ActualRun | null; ended: boolean } {
    if (sample.mode !== "AUTO" || sample.enabled !== true) {
      const ended = this.run;
      this.run = null;
      return { run: ended, ended: ended !== null };
    }
    // A moment without a pose (a dropped update) keeps the run going.
    const pose = sample.pose;
    if (!pose) return { run: this.run, ended: false };
    if (!this.run) {
      this.startedAt = sample.time;
      this.run = { autoName: sample.autoName ?? "Unknown auto", recordedAt: sample.time, seconds: 0, points: [{ t: 0, ...pose }] };
      return { run: this.run, ended: false };
    }
    const last = this.run.points[this.run.points.length - 1];
    const turned = Math.abs(((pose.heading - last.heading + 540) % 360) - 180);
    if (Math.hypot(pose.x - last.x, pose.y - last.y) < minimumStepMeters && turned < minimumTurnDegrees) {
      return { run: this.run, ended: false };
    }
    const t = (sample.time - this.startedAt) / 1000;
    this.run = { ...this.run, seconds: t, points: [...this.run.points.slice(-(maxPoints - 1)), { t, ...pose }] };
    return { run: this.run, ended: false };
  }
}

const storageKey = "powerlib.autoBuilder.actualRuns.v1";
const keptRuns = 20;

/** The latest run of each auto, kept on this laptop. */
export function readRuns(): Record<string, ActualRun> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

export function saveRuns(runs: Record<string, ActualRun>) {
  const newest = Object.values(runs).sort((a, b) => b.recordedAt - a.recordedAt).slice(0, keptRuns);
  try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(newest.map(run => [run.autoName, run])))); }
  catch { /* Runs just won't survive a restart. */ }
}
