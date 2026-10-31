import type { GeneratedSubsystem } from "../subsystems/types";
import type { LogValue, Pose, WpilogFile } from "./wpilog";

export type Series<T> = { times: number[]; values: T[] };
export type MechanismKind = "velocity" | "position";
export type LogMechanism = {
  id: string;
  name: string;
  kind: MechanismKind;
  units: string;
  value: Series<number>;
  setpoint?: Series<number>;
  atTarget?: Series<boolean>;
  /** Finite range across value and setpoint, for graph axes and tolerances. */
  min: number;
  max: number;
};
export type LogPeriod = { mode: string; label: string; start: number; end: number };
export type LogMarker = { time: number; kind: "brownout" | "setpoint" | "can"; label: string; mechanismId?: string };
/** `settling` is true when inside the tolerance band but not yet for the 0.5 s that counts as settled. */
export type StepStats = { from: number; to: number; overshootPercent: number; settleSeconds: number | null; settling: boolean };
export type LogModel = {
  /** All times are seconds from the start of the log. */
  duration: number;
  mechanisms: LogMechanism[];
  battery?: Series<number>;
  can?: Series<number>;
  state?: Series<string>;
  pose?: Series<Pose>;
  periods: LogPeriod[];
  markers: LogMarker[];
  signalCount: number;
  /** True when values came from `/PowerLib/Data` JSON frames rather than per-key signals. */
  usedFrames: boolean;
};

type Metric = { series: Series<LogValue>; metadata: string };
const ignoredOwners = new Set(["Drive", "Swerve", "RobotStatus", "DS"]);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Where a log signal belongs in the PowerLib shared map, whichever tool wrote the log. */
export function metricKey(name: string): { owner: string; key: string } | null {
  const shared = /(?:^|\/)Subsystems\/([^/]+)\/Data\/(.+)$/.exec(name);
  if (shared) return { owner: shared[1], key: shared[2] };
  const legacy = /(?:^|\/)PowerLib\/Drive\/(.+)$/.exec(name);
  if (legacy) return { owner: "Drive", key: legacy[1] };
  const status = /(?:^|\/)RobotStatus\/(.+)$/.exec(name);
  if (status) return { owner: "RobotStatus", key: status[1] };
  const ds = /^DS:(enabled|autonomous|test)$/.exec(name);
  if (ds) return { owner: "DS", key: ds[1] };
  return null;
}

/** Signals Owlet adds to every .hoot export, used when the robot didn't log the PowerLib key. */
const owletSignals: Record<string, string> = {
  Voltage: "Drive/BatteryVolts",
  "CAN Utilization": "Drive/RioCanUtilization",
  RobotMode: "Drive/Mode",
  RobotEnable: "Drive/Enabled"
};

/** Plain `<Name> Velocity` / `<Name> Position` / `<Name> Setpoint` signals from robots without PowerLib. */
export function plainMechanismKey(name: string): { owner: string; key: string } | null {
  const match = /^([A-Za-z][\w ]*?)[ _/]+(Velocity|Position)(?:[ _/]*(Setpoint|Target))?$/i.exec(name)
    ?? /^([A-Za-z][\w ]*?)[ _/]+(Setpoint|Target)$/i.exec(name);
  if (!match) return null;
  const kind = match[2].toLowerCase();
  if (kind === "setpoint" || kind === "target") return { owner: match[1].trim(), key: "Setpoint" };
  const value = kind === "velocity" ? "Velocity" : "Position";
  return { owner: match[1].trim(), key: match[3] ? `${value}Setpoint` : value };
}

export function buildLogModel(file: WpilogFile, subsystems: GeneratedSubsystem[] = []): LogModel {
  const direct = new Map<string, Metric>();
  const framed = new Map<string, Metric>();
  const fallback = new Map<string, Metric>();
  for (const signal of file.signals.values()) {
    if (signal.times.length === 0) continue;
    if (/(?:^|\/)PowerLib\/Data$/.test(signal.name) && (signal.type === "json" || signal.type === "string")) {
      expandFrames(signal.times, signal.values, framed);
      continue;
    }
    const metric = { series: { times: signal.times, values: signal.values }, metadata: signal.metadata };
    const target = metricKey(signal.name);
    if (target) { direct.set(`${target.owner}/${target.key}`, metric); continue; }
    const plain = owletSignals[signal.name] ? null : plainMechanismKey(signal.name);
    const key = owletSignals[signal.name] ?? (plain && !ignoredOwners.has(plain.owner) ? `${plain.owner}/${plain.key}` : undefined);
    if (key && !fallback.has(key)) fallback.set(key, metric);
  }
  const metrics = new Map(direct);
  let usedFrames = false;
  for (const [key, metric] of framed) {
    if (!metrics.has(key)) { metrics.set(key, metric); usedFrames = true; }
  }
  for (const [key, metric] of fallback) if (!metrics.has(key)) metrics.set(key, metric);

  let origin = Infinity;
  let last = -Infinity;
  for (const { series } of metrics.values()) {
    origin = Math.min(origin, series.times[0]);
    last = Math.max(last, series.times[series.times.length - 1]);
  }
  if (!Number.isFinite(origin)) {
    return { duration: 0, mechanisms: [], periods: [], markers: [], signalCount: file.signals.size, usedFrames: false };
  }
  for (const metric of metrics.values()) metric.series = { times: metric.series.times.map(time => time - origin), values: metric.series.values };
  const duration = Math.max(0, last - origin);
  const get = (owner: string, key: string) => metrics.get(`${owner}/${key}`);

  const battery = numbers(get("Drive", "BatteryVolts")?.series);
  const can = numbers(get("Drive", "RioCanUtilization")?.series);
  const state = strings((get("Drive", "ActualState") ?? get("Drive", "State"))?.series);
  const periods = findPeriods(metrics, duration);
  const mechanisms = findMechanisms(metrics, subsystems);
  const markers = findMarkers(metrics, mechanisms, periods, battery, can);
  return { duration, mechanisms, battery, can, state, pose: findPose(metrics), periods, markers, signalCount: file.signals.size, usedFrames };
}

function expandFrames(times: number[], values: LogValue[], into: Map<string, Metric>) {
  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index];
    if (typeof raw !== "string") continue;
    let frame: unknown;
    try { frame = JSON.parse(raw); } catch { continue; }
    if (!record(frame) || !record(frame.subsystems)) continue;
    for (const [owner, metrics] of Object.entries(frame.subsystems)) {
      if (!record(metrics)) continue;
      for (const [key, value] of Object.entries(metrics)) {
        let decoded: LogValue;
        if (record(value)) {
          const { xMeters, yMeters, headingRadians } = value;
          if (typeof xMeters !== "number" || typeof yMeters !== "number" || typeof headingRadians !== "number") continue;
          decoded = { x: xMeters, y: yMeters, heading: headingRadians };
        } else if (value === null) decoded = key === "Pose" ? null : NaN;
        else if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") decoded = value;
        else continue;
        const id = `${owner}/${key}`;
        const metric = into.get(id) ?? { series: { times: [], values: [] }, metadata: "" };
        metric.series.times.push(times[index]);
        metric.series.values.push(decoded);
        into.set(id, metric);
      }
    }
  }
}

function numbers(series: Series<LogValue> | undefined): Series<number> | undefined {
  if (!series || !series.values.some(value => typeof value === "number")) return undefined;
  return { times: series.times, values: series.values.map(value => typeof value === "number" ? value : NaN) };
}

function booleans(series: Series<LogValue> | undefined): Series<boolean> | undefined {
  if (!series || !series.values.some(value => typeof value === "boolean")) return undefined;
  return { times: series.times, values: series.values.map(value => value === true) };
}

function strings(series: Series<LogValue> | undefined): Series<string> | undefined {
  if (!series || !series.values.some(value => typeof value === "string")) return undefined;
  return { times: series.times, values: series.values.map(value => typeof value === "string" ? value : "") };
}

/** Index of the last sample at or before `time`, or -1. */
export function indexAt(times: number[], time: number) {
  let low = 0;
  let high = times.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (times[middle] <= time) { found = middle; low = middle + 1; } else high = middle - 1;
  }
  return found;
}

export function valueAt<T>(series: Series<T> | undefined, time: number): T | undefined {
  if (!series) return undefined;
  const index = indexAt(series.times, time);
  return index < 0 ? undefined : series.values[index];
}

/** Consecutive runs of equal values, ending at the next change or `end`. */
export function segments<T>(series: Series<T>, end: number) {
  const runs: { value: T; start: number; end: number }[] = [];
  for (let index = 0; index < series.values.length; index += 1) {
    const value = series.values[index];
    const previous = runs[runs.length - 1];
    if (previous && previous.value === value) continue;
    if (previous) previous.end = series.times[index];
    runs.push({ value, start: series.times[index], end });
  }
  return runs;
}

const titleCase = (mode: string) => mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
/** PowerLib logs AUTO/TELEOP/TEST/DISABLED; Owlet's RobotMode logs Autonomous/Teleop/Test/Disabled. */
const modeName = (mode: string) => {
  const upper = mode.trim().toUpperCase();
  return upper === "AUTONOMOUS" ? "AUTO" : upper === "TELEOPERATED" ? "TELEOP" : upper;
};

function findPeriods(metrics: Map<string, Metric>, duration: number): LogPeriod[] {
  const rawMode = strings(metrics.get("Drive/Mode")?.series);
  const mode = rawMode && { times: rawMode.times, values: rawMode.values.map(modeName) };
  let runs: { mode: string; start: number; end: number }[] = [];
  if (mode) {
    runs = segments(mode, duration).filter(run => run.value && run.value !== "DISABLED").map(run => ({ mode: run.value, start: run.start, end: run.end }));
  } else {
    const enabled = booleans((metrics.get("Drive/Enabled") ?? metrics.get("DS/enabled"))?.series);
    const auto = booleans(metrics.get("DS/autonomous")?.series);
    if (enabled) {
      runs = segments(enabled, duration).filter(run => run.value)
        .map(run => ({ mode: valueAt(auto, run.start + 0.05) ? "AUTO" : auto ? "TELEOP" : "ENABLED", start: run.start, end: run.end }));
    }
  }
  const counts = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const run of runs) totals.set(run.mode, (totals.get(run.mode) ?? 0) + 1);
  return runs.map(run => {
    const count = (counts.get(run.mode) ?? 0) + 1;
    counts.set(run.mode, count);
    return { ...run, label: (totals.get(run.mode) ?? 0) > 1 ? `${titleCase(run.mode)} ${count}` : titleCase(run.mode) };
  });
}

function parseUnits(metadata: string) {
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (record(parsed)) {
      const units = parsed.units ?? parsed.unit;
      if (typeof units === "string" && units.trim()) return units.trim();
    }
  } catch { /* Metadata is free text; units are optional. */ }
  return undefined;
}

const shortUnits: Record<string, string> = { "rotations per second": "rps", rotations: "rot", degrees: "deg", meters: "m", volts: "V" };

function findMechanisms(metrics: Map<string, Metric>, subsystems: GeneratedSubsystem[]): LogMechanism[] {
  const normalize = (name: string) => name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const configs = new Map(subsystems.map(config => [normalize(config.name || config.id || ""), config]));
  const owners = new Set<string>();
  for (const key of metrics.keys()) {
    const owner = key.slice(0, key.indexOf("/"));
    if (!ignoredOwners.has(owner)) owners.add(owner);
  }
  const mechanisms: LogMechanism[] = [];
  for (const owner of [...owners].sort()) {
    const get = (key: string) => metrics.get(`${owner}/${key}`);
    const kind: MechanismKind | undefined = get("Velocity") ? "velocity" : get("Position") ? "position" : undefined;
    if (!kind) continue;
    const valueMetric = get(kind === "velocity" ? "Velocity" : "Position")!;
    const value = numbers(valueMetric.series);
    if (!value) continue;
    const setpointMetric = kind === "velocity" ? get("VelocitySetpoint") ?? get("Setpoint")
      : get("PositionSetpoint") ?? get("SetpointRotations") ?? get("Setpoint");
    const setpoint = numbers(setpointMetric?.series);
    const config = configs.get(normalize(owner));
    const logged = parseUnits(valueMetric.metadata);
    const units = (logged && (shortUnits[logged] ?? logged))
      ?? (kind === "velocity" ? "rps" : config?.absolutePosition?.units ?? config?.position?.units ?? config?.relativePosition?.units ?? "rot");
    let min = Infinity;
    let max = -Infinity;
    for (const sample of [...value.values, ...(setpoint?.values ?? [])]) {
      if (Number.isFinite(sample)) { min = Math.min(min, sample); max = Math.max(max, sample); }
    }
    if (!Number.isFinite(min)) { min = 0; max = 1; }
    mechanisms.push({ id: owner, name: config?.name || owner.replace(/([a-z0-9])([A-Z])/g, "$1 $2"), kind, units, value, setpoint,
      atTarget: booleans((get("AtTarget") ?? get("AtSetpoint"))?.series), min, max });
  }
  return mechanisms;
}

/**
 * The mechanism with the most setpoint changes, so a log opens on something that moved. Without
 * setpoints, the one whose value changed most often by more than 5% of its range.
 */
export function busiestMechanism(mechanisms: LogMechanism[]) {
  const changes = (values: number[], step: number) => {
    let count = 0;
    let last = values.find(Number.isFinite);
    for (const value of values) {
      if (Number.isFinite(value) && last !== undefined && Math.abs(value - last) > step) { count += 1; last = value; }
    }
    return count;
  };
  const score = (mechanism: LogMechanism) => mechanism.setpoint
    ? [1, changes(mechanism.setpoint.values, 0)]
    : [0, changes(mechanism.value.values, (mechanism.max - mechanism.min) * 0.05)];
  let best: LogMechanism | undefined;
  let bestScore = [-1, -1];
  for (const mechanism of mechanisms) {
    const next = score(mechanism);
    if (next[0] > bestScore[0] || (next[0] === bestScore[0] && next[1] > bestScore[1])) { best = mechanism; bestScore = next; }
  }
  return best;
}

/** How far from the setpoint still counts as on target when the robot doesn't log it. */
export function toleranceFor(mechanism: LogMechanism, setpoint: number) {
  return Math.max(Math.abs(setpoint) * 0.05, (mechanism.max - mechanism.min) * 0.02, 1e-6);
}

function findMarkers(metrics: Map<string, Metric>, mechanisms: LogMechanism[], periods: LogPeriod[],
  battery: Series<number> | undefined, can: Series<number> | undefined): LogMarker[] {
  const markers: LogMarker[] = [];
  const brownedOut = booleans(metrics.get("RobotStatus/BrownedOut")?.series);
  if (brownedOut) {
    for (const run of segments(brownedOut, Infinity)) if (run.value) markers.push({ time: run.start, kind: "brownout", label: "Brownout" });
  } else if (battery) {
    edges(battery, value => value < 7, value => value > 8, time => markers.push({ time, kind: "brownout", label: "Low battery" }));
  }
  if (can) {
    const percent = Math.max(...can.values.filter(Number.isFinite)) > 1.5;
    const fraction = (value: number) => percent ? value / 100 : value;
    edges(can, value => fraction(value) > 0.9, value => fraction(value) < 0.8, time => {
      const peak = valueAt(can, time) ?? 0;
      markers.push({ time, kind: "can", label: `CAN ${Math.round(fraction(peak) * 100)}%` });
    });
  }
  const enabledAt = (time: number) => periods.length === 0 || periods.some(period => time >= period.start && time < period.end);
  for (const mechanism of mechanisms) {
    if (!mechanism.setpoint) continue;
    let changedAt = -Infinity;
    let previousSetpoint: number | undefined;
    let missStart: number | null = null;
    let marked = false;
    for (let index = 0; index < mechanism.value.times.length; index += 1) {
      const time = mechanism.value.times[index];
      const target = valueAt(mechanism.setpoint, time);
      const actual = mechanism.value.values[index];
      if (target !== previousSetpoint) { changedAt = time; previousSetpoint = target; }
      const missing = target !== undefined && Number.isFinite(target) && Number.isFinite(actual) && enabledAt(time)
        && time - changedAt >= 1 && Math.abs(actual - target) > toleranceFor(mechanism, target);
      if (!missing) { missStart = null; marked = false; continue; }
      missStart ??= time;
      if (!marked && time - missStart >= 0.5) {
        markers.push({ time: missStart, kind: "setpoint", label: `${mechanism.name} missed setpoint`, mechanismId: mechanism.id });
        marked = true;
      }
    }
  }
  return markers.sort((left, right) => left.time - right.time).slice(0, 200);
}

function edges(series: Series<number>, trigger: (value: number) => boolean, reset: (value: number) => boolean, onEdge: (time: number) => void) {
  let armed = true;
  for (let index = 0; index < series.values.length; index += 1) {
    const value = series.values[index];
    if (!Number.isFinite(value)) continue;
    if (armed && trigger(value)) { onEdge(series.times[index]); armed = false; } else if (!armed && reset(value)) armed = true;
  }
}

function findPose(metrics: Map<string, Metric>): Series<Pose> | undefined {
  const struct = metrics.get("Drive/Pose")?.series;
  if (struct) {
    const times: number[] = [];
    const values: Pose[] = [];
    struct.values.forEach((value, index) => {
      if (record(value) && [value.x, value.y, value.heading].every(Number.isFinite)) { times.push(struct.times[index]); values.push(value as Pose); }
    });
    if (values.length) return { times, values };
  }
  for (const owner of ["Drive", "Swerve"]) {
    const x = numbers(metrics.get(`${owner}/Pose/XMeters`)?.series);
    const y = numbers(metrics.get(`${owner}/Pose/YMeters`)?.series);
    const heading = numbers((metrics.get(`${owner}/Pose/HeadingDegrees`) ?? metrics.get(`${owner}/Pose/RotationDegrees`))?.series);
    if (!x || !y) continue;
    const times: number[] = [];
    const values: Pose[] = [];
    x.times.forEach((time, index) => {
      const pose = { x: x.values[index], y: valueAt(y, time) ?? NaN, heading: ((valueAt(heading, time) ?? 0) * Math.PI) / 180 };
      if ([pose.x, pose.y, pose.heading].every(Number.isFinite)) { times.push(time); values.push(pose); }
    });
    if (values.length) return { times, values };
  }
  return undefined;
}

/** Overshoot and settle time for the setpoint step in effect at `time`. */
export function stepStats(mechanism: LogMechanism, time: number): StepStats | null {
  const setpoint = mechanism.setpoint;
  if (!setpoint) return null;
  const current = indexAt(setpoint.times, time);
  if (current <= 0) return null;
  let first = current;
  while (first > 0 && setpoint.values[first - 1] === setpoint.values[current]) first -= 1;
  if (first === 0) return null;
  const from = setpoint.values[first - 1];
  const to = setpoint.values[current];
  const step = to - from;
  if (!Number.isFinite(step) || step === 0) return null;
  const stepTime = setpoint.times[first];
  const tolerance = toleranceFor(mechanism, to);
  const { times, values } = mechanism.value;
  let peak = 0;
  let settleSeconds: number | null = null;
  let inBandSince: number | null = null;
  for (let index = Math.max(0, indexAt(times, stepTime)); index < times.length && times[index] <= time; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    peak = Math.max(peak, (value - to) * Math.sign(step));
    if (Math.abs(value - to) <= tolerance) {
      inBandSince ??= times[index];
      if (settleSeconds === null && times[index] - inBandSince >= 0.5) settleSeconds = inBandSince - stepTime;
    } else inBandSince = null;
  }
  return { from, to, overshootPercent: (peak / Math.abs(step)) * 100, settleSeconds, settling: settleSeconds === null && inBandSince !== null };
}
