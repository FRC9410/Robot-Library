/** Default telemetry transport and screen refresh cadence: 10 Hz. */
export const telemetryUpdateIntervalMs = 100;

/** Tuning transport, reconciliation and displayed values: 5 Hz. */
export const tuningUpdateIntervalMs = 200;

export const nt4Intervals = {
  updateIntervalMs: { defaultValue: telemetryUpdateIntervalMs, min: 20, max: 500 },
  heartbeatIntervalMs: { defaultValue: 250, min: 100, max: 1000 }
};

export type Nt4Timing = Record<keyof typeof nt4Intervals, number>;

export const defaultNt4Timing: Nt4Timing = {
  updateIntervalMs: nt4Intervals.updateIntervalMs.defaultValue,
  heartbeatIntervalMs: nt4Intervals.heartbeatIntervalMs.defaultValue
};

export function validNt4Interval(name: keyof Nt4Timing, value: unknown): value is number {
  const { min, max } = nt4Intervals[name];
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
