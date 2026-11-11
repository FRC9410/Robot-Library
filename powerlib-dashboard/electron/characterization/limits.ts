import type { PositionTest, Settings, Target, TestLimits } from "./types.js";

export const defaultSettings: Settings = { duration: 5, ramp: 1, rampLimit: 4, step: 4, settle: 1, medianWindow: 5 };

export const limitsFields = [
  ["duration", "Test duration (s)", .5, 10],
  ["ramp", "Ramp (V/s)", .1, 2],
  ["rampLimit", "Ramp voltage ceiling (V)", .1, 6],
  ["step", "Dynamic step (V)", .1, 6]
] as const;

export function resolveLimits(settings: Settings, group?: string): Required<TestLimits> {
  const override = group && settings.targetLimits && Object.hasOwn(settings.targetLimits, group) ? settings.targetLimits[group] : undefined;
  const { duration, ramp, step, rampLimit = step } = override ?? settings;
  return { duration, ramp, step, rampLimit };
}

export function resolveTargetLimits(settings: Settings, target: Target): Required<TestLimits> {
  return resolveLimits(settings, settings.targetLimits && Object.hasOwn(settings.targetLimits, target.id) ? target.id : target.group);
}

export function validPositionTest(value: PositionTest | undefined): value is PositionTest {
  return !!value && (value.model === "elevator" || value.model === "arm" && Number.isFinite(value.horizontal))
    && [value.lower, value.upper, value.margin, value.speedLimit, value.upper - value.lower].every(Number.isFinite)
    && value.margin > 0 && value.margin < (value.upper - value.lower) / 2 && value.speedLimit > 0
    && (value.polarity === 1 || value.polarity === -1);
}

export function validSettings(settings: Settings, groups: string[]): boolean {
  if (!settings || !Number.isFinite(settings.settle) || settings.settle < .2 || settings.settle > 10
    || ![1, 3, 5, 7, 9].includes(settings.medianWindow)) return false;
  return [undefined, ...groups].every(group => {
    const values = resolveLimits(settings, group);
    return limitsFields.every(([key, , min, max]) => Number.isFinite(values[key]) && values[key] >= min && values[key] <= max);
  });
}
