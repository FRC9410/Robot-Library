import { indexAt } from "./series";
import type { Series } from "./series";
import type { LogValue, ModuleState } from "./wpilog";

/** Measured and commanded module states, in CTRE's module order: front left, front right, back left, back right. */
export type SwerveModules = { states: Series<ModuleState[]>; targets?: Series<ModuleState[]> };

export const moduleNames = ["FL", "FR", "BL", "BR"];
/** Corners in the robot's frame (x forward, y left), in module order. A fifth or later module reuses the last corner. */
export const moduleCorners = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** A wheel counts as off when it points more than this far from its target while it's told to move. */
export const offDegrees = 15;
const movingSpeed = 0.1;

const isModules = (value: LogValue): value is ModuleState[] => Array.isArray(value) && value.length > 0
  && value.every(module => typeof module === "object" && module !== null
    && Number.isFinite((module as ModuleState).speed) && Number.isFinite((module as ModuleState).angle));

/** Keeps only complete, finite samples. */
export function moduleSeries(series: Series<LogValue> | undefined): Series<ModuleState[]> | undefined {
  if (!series) return undefined;
  const times: number[] = [];
  const values: ModuleState[][] = [];
  series.values.forEach((value, index) => {
    if (isModules(value)) { times.push(series.times[index]); values.push(value); }
  });
  return times.length ? { times, values } : undefined;
}

export function findSwerveModules(states: Series<LogValue> | undefined, targets: Series<LogValue> | undefined): SwerveModules | undefined {
  const measured = moduleSeries(states);
  return measured ? { states: measured, targets: moduleSeries(targets) } : undefined;
}

/** The way the wheel is rolling, in radians from robot forward: a wheel driving backward points the other way. */
export function travelAngle(module: ModuleState) {
  return module.speed < 0 ? module.angle + Math.PI : module.angle;
}

/**
 * Degrees between where a wheel points and where it was told to point. A wheel turned half a circle and driving
 * backward goes the same way, so this is at most 90. Null when the target isn't asking it to move.
 */
export function moduleErrorDegrees(actual: ModuleState, target: ModuleState): number | null {
  if (Math.abs(target.speed) < movingSpeed) return null;
  const difference = Math.abs(actual.angle - target.angle) % Math.PI;
  return (Math.min(difference, Math.PI - difference) * 180) / Math.PI;
}

/** The latest sample at or before `time`, or nothing when the newest one is over `maxAge` seconds old. */
export function modulesAt(series: Series<ModuleState[]> | undefined, time: number, maxAge = 0.5): ModuleState[] | undefined {
  if (!series) return undefined;
  const found = indexAt(series.times, time);
  return found >= 0 && time - series.times[found] <= maxAge ? series.values[found] : undefined;
}
