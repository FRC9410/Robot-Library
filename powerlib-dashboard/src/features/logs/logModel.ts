import type { GeneratedSubsystem } from "../subsystems/types";
import { indexAt } from "./series";
import type { Series } from "./series";
import { findSwerveModules } from "./swerveModel";
import type { SwerveModules } from "./swerveModel";
import type { LogValue, Pose, WpilogFile } from "./wpilog";

export { indexAt };
export type { Series };
/** `motors` is a group of motors with no PowerLib value: a group like Drive, or one unassigned motor. Its value is power. */
export type MechanismKind = "velocity" | "position" | "motors";
export type MotorSignal = "SupplyCurrent" | "SupplyVoltage" | "MotorVoltage" | "StatorCurrent" | "DeviceTemp" | "Position";
/**
 * How a motor's group was decided, strongest first: the Assign motors dialog, robot Java configuration,
 * TunerConstants.java's swerve IDs, matching its motion to a mechanism, or the template's usual swerve IDs.
 */
export type MotorSource = "override" | "config" | "tuner" | "motion" | "guess" | "";
export type MotorMetric = "current" | "power" | "voltage" | "stator" | "temp";
export type RangedSeries = Series<number> & { min: number; max: number };
/** What a mechanism graph shows: its PowerLib value vs setpoint, or one of its motor readings. */
export type GraphView = "value" | MotorMetric;
export const motorMetrics: Record<MotorMetric, { label: string; units: string }> = {
  current: { label: "Supply current", units: "A" },
  power: { label: "Power", units: "W" },
  voltage: { label: "Applied voltage", units: "V" },
  stator: { label: "Stator current", units: "A" },
  temp: { label: "Motor temp", units: "°C" }
};
/** One motor controller from Phoenix's auto-logged device signals, keyed by CAN bus and ID. */
export type LogMotor = {
  key: string;
  bus: string;
  id: number;
  label: string;
  signals: Partial<Record<MotorSignal, Series<number>>>;
  peakCurrent: number;
  /** Mechanism or group this motor counts toward, or "" when unassigned. */
  group: string;
  source: MotorSource;
  /** For motion matches, how closely the motor's motion followed the mechanism (|correlation|, 0–1). */
  matchScore?: number;
};
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
  motors: LogMotor[];
  /** Combined motor readings: summed currents and power, mean applied voltage, hottest motor. */
  metrics: Partial<Record<MotorMetric, RangedSeries>>;
};
/** A log file and the CAN bus it came from; a .hoot session has one per bus. */
export type LogSource = { name: string; file: WpilogFile };
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
  /** Swerve module states and targets from PowerLib's `Drive/ModuleStates` and `Drive/ModuleTargets`. */
  swerve?: SwerveModules;
  /** The Driver Station's match countdown (`DriverStation.getMatchTime()`), seconds; negative when there wasn't one. */
  matchTime?: Series<number>;
  /** Whether the robot was connected to a field (FMS), so a real match can be told from practice. */
  fmsAttached?: Series<boolean>;
  periods: LogPeriod[];
  markers: LogMarker[];
  signalCount: number;
  /** True when values came from `/PowerLib/Data` JSON frames rather than per-key signals. */
  usedFrames: boolean;
  /** Every motor found, assigned or not. */
  motors: LogMotor[];
  /** Summed supply current (and power) per assigned group plus one entry for all unassigned motors, for the Power card. */
  powerGroups: { id: string; name: string; current: RangedSeries; power: RangedSeries }[];
  buses: string[];
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
  RobotEnable: "Drive/Enabled",
  "DS:IsFMSAttached": "RobotStatus/FmsAttached"
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

const motorPattern = /(?:^|\/)(TalonFXS?)-(\d+)\/(SupplyCurrent|SupplyVoltage|MotorVoltage|StatorCurrent|DeviceTemp|Position)$/;

/** Signals the Logs tab uses; anything else can be skipped while parsing to save memory. */
export function isViewerSignal(name: string) {
  return /(?:^|\/)PowerLib\/Data$/.test(name) || metricKey(name) !== null || name in owletSignals
    || plainMechanismKey(name) !== null || motorPattern.test(name) || /(?:^|\/)Pose(?:\/|$)/.test(name);
}

/** `rio` for the roboRIO's own CAN bus file, `CANivore` for a CANivore's (named by its hex ID), else the file name. */
export function busName(fileName: string) {
  if (/(^|_)rio_/i.test(fileName)) return "rio";
  if (/[0-9A-F]{16,}/i.test(fileName)) return "CANivore";
  return fileName.replace(/\.(wpilog|hoot)$/i, "");
}

/**
 * `assignments` maps a motor key (`<bus>:<id>`) to a mechanism or group name; "" leaves it unassigned.
 * Other motors are grouped automatically (see `MotorSource`); `driveMotorIds` are the swerve IDs from TunerConstants.java.
 */
export function buildLogModel(input: WpilogFile | LogSource[], subsystems: GeneratedSubsystem[] = [], assignments: Record<string, string> = {},
  driveMotorIds: number[] = []): LogModel {
  const sources = Array.isArray(input) ? input : [{ name: "log", file: input }];
  const usedBuses = new Map<string, number>();
  const buses = sources.map(source => {
    const base = sources.length > 1 ? busName(source.name) : "log";
    const count = (usedBuses.get(base) ?? 0) + 1;
    usedBuses.set(base, count);
    return count > 1 ? `${base} ${count}` : base;
  });
  const direct = new Map<string, Metric>();
  const framed = new Map<string, Metric>();
  const fallback = new Map<string, Metric>();
  const motorSignals = new Map<string, { bus: string; id: number; signals: Partial<Record<MotorSignal, Series<number>>> }>();
  let signalCount = 0;
  sources.forEach((source, index) => {
    for (const signal of source.file.signals.values()) {
      signalCount += 1;
      if (signal.times.length === 0) continue;
      if (/(?:^|\/)PowerLib\/Data$/.test(signal.name) && (signal.type === "json" || signal.type === "string")) {
        expandFrames(signal.times, signal.values, framed);
        continue;
      }
      const motor = motorPattern.exec(signal.name);
      if (motor) {
        const key = `${buses[index]}:${motor[2]}`;
        const entry = motorSignals.get(key) ?? { bus: buses[index], id: Number(motor[2]), signals: {} };
        entry.signals[motor[3] as MotorSignal] = numbers({ times: signal.times, values: signal.values });
        motorSignals.set(key, entry);
        continue;
      }
      const metric = { series: { times: signal.times, values: signal.values }, metadata: signal.metadata };
      const target = metricKey(signal.name);
      if (target) {
        // The roboRIO file comes first; the same custom signals repeated in other bus files are ignored.
        if (!direct.has(`${target.owner}/${target.key}`)) direct.set(`${target.owner}/${target.key}`, metric);
        continue;
      }
      const plain = owletSignals[signal.name] ? null : plainMechanismKey(signal.name);
      const key = owletSignals[signal.name] ?? (plain && !ignoredOwners.has(plain.owner) ? `${plain.owner}/${plain.key}` : undefined);
      if (key && !fallback.has(key)) fallback.set(key, metric);
    }
  });
  const metrics = new Map(direct);
  let usedFrames = false;
  for (const [key, metric] of framed) {
    if (!metrics.has(key)) { metrics.set(key, metric); usedFrames = true; }
  }
  for (const [key, metric] of fallback) if (!metrics.has(key)) metrics.set(key, metric);

  let origin = Infinity;
  let last = -Infinity;
  const allSeries = [...[...metrics.values()].map(metric => metric.series),
    ...[...motorSignals.values()].flatMap(motor => Object.values(motor.signals).filter(series => series !== undefined))];
  for (const series of allSeries) {
    origin = Math.min(origin, series.times[0]);
    last = Math.max(last, series.times[series.times.length - 1]);
  }
  if (!Number.isFinite(origin)) {
    return { duration: 0, mechanisms: [], periods: [], markers: [], signalCount, usedFrames: false, motors: [], powerGroups: [], buses };
  }
  const shift = <T>(series: Series<T>): Series<T> => ({ times: series.times.map(time => time - origin), values: series.values });
  for (const metric of metrics.values()) metric.series = shift(metric.series);
  const duration = Math.max(0, last - origin);
  const get = (owner: string, key: string) => metrics.get(`${owner}/${key}`);

  const battery = numbers(get("Drive", "BatteryVolts")?.series);
  const can = numbers(get("Drive", "RioCanUtilization")?.series);
  const state = strings((get("Drive", "ActualState") ?? get("Drive", "State"))?.series);
  const matchTime = numbers(get("Drive", "MatchTimeSeconds")?.series);
  const fmsAttached = booleans(get("RobotStatus", "FmsAttached")?.series);
  const periods = findPeriods(metrics, duration);
  const mechanisms = findMechanisms(metrics, subsystems);
  const motors = [...motorSignals.entries()].map(([key, motor]) => {
    const signals = Object.fromEntries(Object.entries(motor.signals).map(([name, series]) => [name, series && shift(series)])) as LogMotor["signals"];
    const current = signals.SupplyCurrent?.values ?? [];
    let peakCurrent = 0;
    for (const value of current) if (Number.isFinite(value)) peakCurrent = Math.max(peakCurrent, value);
    return { key, bus: motor.bus, id: motor.id, label: `TalonFX ${motor.id}${buses.length > 1 ? ` · ${motor.bus}` : ""}`, signals, peakCurrent,
      group: "", source: "" as MotorSource };
  }).sort((left, right) => left.bus.localeCompare(right.bus) || left.id - right.id);
  const powerGroups = assignMotors(mechanisms, motors, subsystems, assignments, driveMotorIds, periods, duration, battery);
  const markers = findMarkers(metrics, mechanisms, periods, battery, can);
  const swerve = findSwerveModules(get("Drive", "ModuleStates")?.series, get("Drive", "ModuleTargets")?.series);
  return { duration, mechanisms, battery, can, state, pose: findPose(metrics), swerve, matchTime, fmsAttached, periods, markers, signalCount, usedFrames, motors,
    powerGroups, buses };
}

const normalizeName = (name: string) => name.replace(/[^a-z0-9]/gi, "").toLowerCase();

/** The PowerLib template's swerve motor IDs (TunerConstants.java defaults), used only as a labeled guess. */
const templateSwerveIds = [1, 2, 3, 4, 5, 6, 7, 8];
/** A motion match needs at least this |correlation| between the motor and the mechanism. */
const motionMatchThreshold = 0.9;

/** Puts motors into mechanisms (or new groups), computes their combined readings, and returns the power widget's groups. */
function assignMotors(mechanisms: LogMechanism[], motors: LogMotor[], subsystems: GeneratedSubsystem[], assignments: Record<string, string>,
  driveMotorIds: number[], periods: LogPeriod[], duration: number, battery: Series<number> | undefined) {
  // PowerLib mechanisms and the swerve default to the CANivore; when an ID is on both buses, configs mean the CANivore one.
  const onOtherBus = (motor: LogMotor) => motor.bus === "rio" && motors.some(other => other !== motor && other.id === motor.id && other.bus !== "rio");
  for (const motor of motors) {
    if (motor.key in assignments) { motor.group = assignments[motor.key]; motor.source = "override"; continue; }
    if (onOtherBus(motor)) continue;
    const config = subsystems.find(subsystem => subsystem.motors?.some(entry => Number(entry.id) === motor.id));
    if (config) { motor.group = config.name || config.id || ""; motor.source = "config"; }
    else if (driveMotorIds.includes(motor.id)) { motor.group = "Drive"; motor.source = "tuner"; }
  }
  matchByMotion(mechanisms, motors.filter(motor => !motor.source), periods, duration);
  if (driveMotorIds.length === 0) {
    for (const bus of new Set(motors.map(motor => motor.bus))) {
      const leftover = motors.filter(motor => motor.bus === bus && !motor.source && templateSwerveIds.includes(motor.id));
      if (leftover.length === templateSwerveIds.length) for (const motor of leftover) { motor.group = "Drive"; motor.source = "guess"; }
    }
  }
  const byName = new Map(mechanisms.map(mechanism => [normalizeName(mechanism.id), mechanism]));
  const groups = new Map<string, LogMotor[]>();
  for (const motor of motors) {
    if (!motor.group) continue;
    const key = normalizeName(motor.group);
    groups.set(key, [...(groups.get(key) ?? []), motor]);
  }
  const powerGroups: LogModel["powerGroups"] = [];
  for (const [key, members] of groups) {
    let mechanism = byName.get(key);
    const combined = combineMotors(members, battery);
    if (!mechanism) {
      if (!combined.power) continue;
      mechanism = { id: members[0].group, name: members[0].group, kind: "motors", units: "W", value: combined.power, min: combined.power.min,
        max: combined.power.max, motors: [], metrics: {} };
      mechanisms.push(mechanism);
    }
    mechanism.motors = members;
    mechanism.metrics = combined;
    if (combined.power && combined.current) powerGroups.push({ id: mechanism.id, name: mechanism.name, current: combined.current, power: combined.power });
  }
  const unassigned = motors.filter(motor => !motor.group);
  for (const motor of unassigned) {
    const combined = combineMotors([motor], battery);
    if (!combined.power) continue;
    mechanisms.push({ id: `motor:${motor.key}`, name: motor.label, kind: "motors", units: "W", value: combined.power, min: combined.power.min,
      max: combined.power.max, motors: [motor], metrics: combined });
  }
  // A fixed order for the power widget: biggest average user over the whole log first, unassigned last.
  const meanPower = (series: RangedSeries) => {
    let sum = 0; let count = 0;
    for (const value of series.values) if (Number.isFinite(value)) { sum += Math.max(0, value); count += 1; }
    return count ? sum / count : 0;
  };
  powerGroups.sort((left, right) => meanPower(right.power) - meanPower(left.power));
  const other = unassigned.length ? combineMotors(unassigned, battery) : {};
  if (other.power && other.current) powerGroups.push({ id: "unassigned", name: "Unassigned motors", current: other.current, power: other.power });
  return powerGroups;
}

/** Pearson correlation of two equal-length arrays, skipping pairs with a non-finite value; NaN if either barely moves. */
export function correlation(left: number[], right: number[]) {
  let count = 0; let sumLeft = 0; let sumRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (Number.isFinite(left[index]) && Number.isFinite(right[index])) { count += 1; sumLeft += left[index]; sumRight += right[index]; }
  }
  if (count < 10) return NaN;
  const meanLeft = sumLeft / count;
  const meanRight = sumRight / count;
  let cross = 0; let varianceLeft = 0; let varianceRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (!Number.isFinite(left[index]) || !Number.isFinite(right[index])) continue;
    const a = left[index] - meanLeft;
    const b = right[index] - meanRight;
    cross += a * b; varianceLeft += a * a; varianceRight += b * b;
  }
  return varianceLeft > 1e-9 && varianceRight > 1e-9 ? cross / Math.sqrt(varianceLeft * varianceRight) : NaN;
}

/**
 * Matches each unassigned motor to the mechanism whose motion it follows best, while the robot was
 * enabled. Position mechanisms compare against the motor's position; velocity mechanisms against its
 * speed (change in position). Correlation ignores gear ratios and units, and its sign ignores inverted
 * followers. Each motor goes to its single best match, so mechanisms that run together (like a feeder
 * and a spindexer) still separate.
 */
function matchByMotion(mechanisms: LogMechanism[], motors: LogMotor[], periods: LogPeriod[], duration: number) {
  const candidates = mechanisms.filter(mechanism => mechanism.kind !== "motors");
  if (!candidates.length || !motors.length || duration <= 0) return;
  const spans = periods.length ? periods.map(period => [period.start, period.end]) : [[0, duration]];
  const total = spans.reduce((sum, [start, end]) => sum + (end - start), 0);
  const step = Math.max(0.1, total / 3000);
  const half = step / 2;
  const grid: number[] = [];
  for (const [start, end] of spans) for (let time = start + half; time < end - half; time += step) grid.push(time);
  const sample = (series: Series<number>, offset = 0) => { const at = cursor(series); return grid.map(time => at(time + offset) ?? NaN); };
  const traces = candidates.map(mechanism => sample(mechanism.value));
  for (const motor of motors) {
    const position = motor.signals.Position;
    if (!position) continue;
    const motorPosition = sample(position);
    const before = sample(position, -half);
    const after = sample(position, half);
    const motorSpeed = grid.map((_, index) => (after[index] - before[index]) / step);
    let best: { mechanism: LogMechanism; score: number } | undefined;
    candidates.forEach((mechanism, index) => {
      const score = Math.abs(correlation(traces[index], mechanism.kind === "velocity" ? motorSpeed : motorPosition));
      if (Number.isFinite(score) && (!best || score > best.score)) best = { mechanism, score };
    });
    if (best && best.score >= motionMatchThreshold) {
      motor.group = best.mechanism.id;
      motor.source = "motion";
      motor.matchScore = best.score;
    }
  }
}

/** Reads a series at increasing times by walking forward instead of searching. */
function cursor(series: Series<number> | undefined) {
  let index = -1;
  return (time: number) => {
    if (!series) return undefined;
    while (index + 1 < series.times.length && series.times[index + 1] <= time) index += 1;
    return index < 0 ? undefined : series.values[index];
  };
}

function ranged(times: number[], values: number[]): RangedSeries | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
  if (!Number.isFinite(min)) return undefined;
  if (min === max) { min -= 1; max += 1; }
  return { times, values, min, max };
}

/** Sums supply/stator current and power, averages applied voltage and takes the hottest temperature, on the busiest motor's timestamps. */
export function combineMotors(motors: LogMotor[], battery?: Series<number>): Partial<Record<MotorMetric, RangedSeries>> {
  const base = motors.map(motor => motor.signals.SupplyCurrent ?? motor.signals.MotorVoltage)
    .filter((series): series is Series<number> => series !== undefined)
    .sort((left, right) => right.times.length - left.times.length)[0];
  if (!base) return {};
  const readers = motors.map(motor => ({
    supply: cursor(motor.signals.SupplyCurrent), volts: cursor(motor.signals.SupplyVoltage), applied: cursor(motor.signals.MotorVoltage),
    stator: cursor(motor.signals.StatorCurrent), temp: cursor(motor.signals.DeviceTemp)
  }));
  const batteryAt = cursor(battery);
  const out: Record<MotorMetric, number[]> = { current: [], power: [], voltage: [], stator: [], temp: [] };
  for (const time of base.times) {
    const fallbackVolts = batteryAt(time);
    let current = 0; let power = 0; let applied = 0; let appliedCount = 0; let stator = 0; let temp = -Infinity;
    let hasCurrent = false; let hasStator = false;
    for (const reader of readers) {
      const supply = reader.supply(time);
      if (supply !== undefined && Number.isFinite(supply)) {
        hasCurrent = true;
        current += supply;
        power += supply * (reader.volts(time) ?? fallbackVolts ?? 12);
      }
      const volts = reader.applied(time);
      if (volts !== undefined && Number.isFinite(volts)) { applied += volts; appliedCount += 1; }
      const statorAmps = reader.stator(time);
      if (statorAmps !== undefined && Number.isFinite(statorAmps)) { hasStator = true; stator += statorAmps; }
      const degrees = reader.temp(time);
      if (degrees !== undefined && Number.isFinite(degrees)) temp = Math.max(temp, degrees);
    }
    out.current.push(hasCurrent ? current : NaN);
    out.power.push(hasCurrent ? power : NaN);
    out.voltage.push(appliedCount ? applied / appliedCount : NaN);
    out.stator.push(hasStator ? stator : NaN);
    out.temp.push(Number.isFinite(temp) ? temp : NaN);
  }
  const result: Partial<Record<MotorMetric, RangedSeries>> = {};
  for (const metric of Object.keys(out) as MotorMetric[]) {
    const series = ranged(base.times, out[metric]);
    if (series) result[metric] = series;
  }
  return result;
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

/**
 * Mean of the finite samples in (time - span, time], for readouts of noisy 100 Hz motor data.
 * Falls back to the latest sample when none fall inside the span.
 */
export function averageAt(series: Series<number> | undefined, time: number, span = 0.5): number | undefined {
  if (!series) return undefined;
  const last = indexAt(series.times, time);
  if (last < 0) return undefined;
  let sum = 0; let count = 0;
  for (let index = last; index >= 0 && series.times[index] > time - span; index -= 1) {
    if (Number.isFinite(series.values[index])) { sum += series.values[index]; count += 1; }
  }
  return count ? sum / count : series.values[last];
}

/**
 * Means of the finite samples in fixed time slots [k·step, (k+1)·step) covering [from, to]. Slot edges
 * depend only on `step`, not `from`, so a window sliding during playback doesn't re-sample (no shimmer).
 * Empty slots repeat the previous slot's mean.
 */
export function slotMeans(series: Series<number>, from: number, to: number, step: number) {
  const first = Math.floor(from / step);
  const last = Math.ceil(to / step);
  const starts: number[] = [];
  const means: number[] = [];
  let index = Math.max(0, indexAt(series.times, first * step));
  let previous = NaN;
  for (let slot = first; slot < last; slot += 1) {
    const start = slot * step;
    const end = start + step;
    let sum = 0; let count = 0;
    while (index < series.times.length && series.times[index] < start) index += 1;
    while (index < series.times.length && series.times[index] < end) {
      if (Number.isFinite(series.values[index])) { sum += series.values[index]; count += 1; }
      index += 1;
    }
    previous = count ? sum / count : previous;
    starts.push(start);
    means.push(previous);
  }
  return { starts, means };
}

/** CAN use at `time` in percent, whether the log stored it as a 0–1 fraction (PowerLib) or a percentage (Owlet). */
export function canPercentAt(can: Series<number> | undefined, time: number) {
  const value = valueAt(can, time);
  if (!can || value === undefined) return undefined;
  let peak = -Infinity;
  for (const sample of can.values) if (Number.isFinite(sample)) peak = Math.max(peak, sample);
  return peak <= 1.5 ? value * 100 : value;
}

/** The match clock at `time` in seconds left, or undefined when the log has no match time then (it reads negative outside a match period). */
export function matchClockAt(matchTime: Series<number> | undefined, time: number) {
  const seconds = valueAt(matchTime, time);
  return seconds !== undefined && Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/** The motor signal behind each per-motor graph view. */
export const motorSignalFor: Record<"current" | "voltage" | "stator", MotorSignal> = { current: "SupplyCurrent", voltage: "MotorVoltage", stator: "StatorCurrent" };

/**
 * The motors' mean reading at each of the busiest motor's timestamps, for a graph that draws every motor and their
 * average. `min`/`max` span every motor's readings averaged over 0.1 s (how the graph draws them) plus zero, so real
 * peaks fit on the axis but single-sample noise doesn't stretch it.
 */
export function motorAverage(motors: LogMotor[], signal: MotorSignal): RangedSeries | undefined {
  const lines = motors.map(motor => motor.signals[signal]).filter((series): series is Series<number> => series !== undefined);
  if (!lines.length) return undefined;
  const base = lines.reduce((busiest, series) => series.times.length > busiest.times.length ? series : busiest);
  const readers = lines.map(series => cursor(series));
  const values = base.times.map(time => {
    let sum = 0; let count = 0;
    for (const read of readers) {
      const value = read(time);
      if (value !== undefined && Number.isFinite(value)) { sum += value; count += 1; }
    }
    return count ? sum / count : NaN;
  });
  let min = 0; let max = 0; let any = false;
  for (const series of lines) {
    if (!series.times.length) continue;
    for (const mean of slotMeans(series, series.times[0], series.times[series.times.length - 1], 0.1).means) {
      if (Number.isFinite(mean)) { min = Math.min(min, mean); max = Math.max(max, mean); any = true; }
    }
  }
  if (!any) return undefined;
  if (min === max) { min -= 1; max += 1; }
  return { times: base.times, values, min, max };
}

export type PoseHeatmap = { cell: number; columns: number; rows: number; counts: number[]; max: number };

/**
 * Where the robot spent its time: pose samples counted in square cells (`cell` meters) over the field, while enabled
 * (the whole log when there are no periods). Poses off the field are left out. Cell `row * columns + column`.
 * Only samples up to `until` count, so the map can fill in as playback runs; `max` is the busiest cell so far, so
 * there's always a red cell and colors adjust as the robot spends time elsewhere.
 */
export function poseHeatmap(pose: Series<Pose>, periods: LogPeriod[], length: number, width: number, cell = 0.3,
  until = Infinity): PoseHeatmap {
  const columns = Math.max(1, Math.ceil(length / cell));
  const rows = Math.max(1, Math.ceil(width / cell));
  const counts = new Array<number>(columns * rows).fill(0);
  let max = 0;
  pose.times.forEach((time, index) => {
    if (time > until) return;
    if (periods.length && !periods.some(period => time >= period.start && time < period.end)) return;
    const column = Math.floor(pose.values[index].x / cell);
    const row = Math.floor(pose.values[index].y / cell);
    if (column < 0 || row < 0 || column >= columns || row >= rows) return;
    const slot = row * columns + column;
    counts[slot] += 1;
    max = Math.max(max, counts[slot]);
  });
  return { cell, columns, rows, counts, max };
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
      atTarget: booleans((get("AtTarget") ?? get("AtSetpoint"))?.series), min, max, motors: [], metrics: {} });
  }
  return mechanisms;
}

/**
 * The mechanism with the most setpoint changes, so a log opens on something that moved. Without
 * setpoints, the one whose value changed most often by more than 5% of its range. Motor-only
 * groups come last.
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
    ? [2, changes(mechanism.setpoint.values, 0)]
    : [mechanism.kind === "motors" ? 0 : 1, changes(mechanism.value.values, (mechanism.max - mechanism.min) * 0.05)];
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
