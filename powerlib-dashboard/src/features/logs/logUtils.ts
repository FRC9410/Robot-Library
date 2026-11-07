import { template } from "../drive/driveModel";
import { indexAt } from "./logModel";
import type { LogMechanism, LogModel, Series } from "./logModel";

export const logColors = {
  value: "#facc15",
  setpoint: "#a78bfa",
  cursor: "#f97316",
  trail: "#34d399",
  grid: "rgba(250, 250, 250, 0.12)",
  good: "#22c55e",
  bad: "#ef4444"
};
/**
 * The logs list's frame, the same in the popup and the drawer. MUI lightens raised surfaces in dark mode
 * with a background image, so it's turned off to match the tab's cards.
 */
export const logsSurface = { bgcolor: "background.paper", backgroundImage: "none", border: 1, borderColor: "divider", p: 2,
  boxSizing: "border-box", display: "flex", flexDirection: "column" } as const;
export const periodColors: Record<string, string> = { AUTO: "#3b82f6", TELEOP: "#22c55e", TEST: "#a855f7", ENABLED: "#22c55e" };
const statePalette = ["#60a5fa", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#22d3ee", "#fb923c", "#a3e635"];
const idleStates = new Set(["", "IDLE", "DISABLED", "NONE"]);

/** The robot's non-idle states in the order they first appear, so each keeps one color. */
export const stateOrder = (state: Series<string> | undefined) =>
  Array.from(new Set((state?.values ?? []).filter(value => !idleStates.has(value.toUpperCase()))));

export function stateColor(state: string, order: string[]) {
  if (idleStates.has(state.toUpperCase())) return "#52525b";
  return statePalette[Math.max(0, order.indexOf(state)) % statePalette.length];
}

/** Colors for per-motor lines and their key, in motor order. */
const motorLineColors = ["#93c5fd", "#fca5a5", "#86efac", "#f0abfc", "#fdba74", "#67e8f9", "#c4b5fd", "#bef264"];
export const motorLineColor = (index: number) => motorLineColors[index % motorLineColors.length];

export type PowerGroup = LogModel["powerGroups"][number];
const groupPalette = ["#60a5fa", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#22d3ee", "#fb923c", "#a3e635", "#e879f9", "#facc15"];

/** A color per group from its place in the full list, so a subsystem keeps its color whatever else is picked. */
export function groupColor(id: string, allGroups: PowerGroup[]) {
  if (id === "unassigned") return "#71717a";
  const index = allGroups.findIndex(group => group.id === id);
  const slot = index >= 0 ? index : allGroups.length + [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return groupPalette[slot % groupPalette.length];
}

/** The picked subsystems that have motor current: groups in the model's fixed order, then picked single motors. */
export function pickedGroups(allGroups: PowerGroup[], selected: LogMechanism[]): PowerGroup[] {
  const ids = new Set(selected.map(mechanism => mechanism.id));
  const extras = selected.filter(mechanism => mechanism.metrics.current && mechanism.metrics.power && !allGroups.some(group => group.id === mechanism.id))
    .map(mechanism => ({ id: mechanism.id, name: mechanism.name, current: mechanism.metrics.current!, power: mechanism.metrics.power! }));
  return [...allGroups.filter(group => ids.has(group.id)), ...extras];
}

export const formatNumber = (value: number | undefined, places = 1) =>
  value === undefined || !Number.isFinite(value) ? "–" : value.toFixed(places).replace(/^-(0(?:\.0+)?)$/, "$1");
export const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}.${Math.floor((seconds * 10) % 10)}`;

/** A `seriesPath` line closed down to `bottom` under each unbroken run, for shading the area under the line. */
export function areaPath(line: string, bottom: number) {
  return line.split("M").filter(Boolean).map(run => {
    const points = run.split("L");
    const firstX = points[0].split(" ")[0];
    const lastX = points[points.length - 1].split(" ")[0];
    return `M${run}L${lastX} ${bottom}L${firstX} ${bottom}Z`;
  }).join("");
}

/** "8:03.7 long · rio + CANivore · 128 signals · 18 motors" for the status bar. */
export const logDetails = (duration: number, buses: string[], signalCount: number, motorCount: number, usedFrames: boolean) =>
  `${formatClock(duration)} long · ${buses.length > 1 ? `${buses.join(" + ")} · ` : ""}${signalCount} signals`
  + `${motorCount ? ` · ${motorCount} motors` : ""}${usedFrames ? " · from 10 Hz NT frames" : ""}`;

/** "1:42" for a match countdown (whole seconds, rounded up the way the Driver Station shows it). */
export const formatMatchClock = (seconds: number) => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
};

/** The same field size and flip the Drive tab is set to on this machine. */
export function readFieldSettings() {
  const defaults = { length: template.field.lengthMeters, width: template.field.widthMeters, flip: false };
  try {
    const saved = JSON.parse(localStorage.getItem("powerlib.driveDisplay.v1") || "{}");
    return {
      length: typeof saved.length === "number" && saved.length > 0 ? saved.length : defaults.length,
      width: typeof saved.width === "number" && saved.width > 0 ? saved.width : defaults.width,
      flip: saved.flip === true
    };
  } catch {
    return defaults;
  }
}

export function readSaved<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || "null");
    return valid(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function writeSaved(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep this session's choice when browser storage is unavailable.
  }
}

/**
 * One path through the visible samples; non-finite values break the line. When there are too many
 * samples to draw, it keeps every Nth sample of the whole log (not of the window), with N fixed by
 * the window length, so the same samples stay drawn while the window slides during playback.
 * With `averageSeconds`, each group of samples is drawn as its mean, at least that long per point,
 * which keeps noisy 100 Hz motor readings readable; the groups are also fixed positions in the log.
 */
export function seriesPath(series: Series<number>, from: number, to: number, x: (time: number) => number, y: (value: number) => number,
  stepped: boolean, averageSeconds = 0) {
  const count = series.times.length;
  const spacing = count > 1 ? (series.times[count - 1] - series.times[0]) / (count - 1) : 1;
  const stride = Math.max(1, Math.ceil((to - from) / Math.max(spacing, 1e-6) / 900), Math.ceil(averageSeconds / Math.max(spacing, 1e-6)));
  let first = Math.max(0, indexAt(series.times, from));
  first -= first % stride;
  const last = Math.min(count - 1, indexAt(series.times, to) + stride);
  if (last < first) return "";
  let path = "";
  let drawing = false;
  let previousY = 0;
  for (let index = first; index <= last; index += stride) {
    let value = series.values[index];
    let time = series.times[index];
    if (averageSeconds > 0) {
      let sum = 0; let sumTime = 0; let samples = 0;
      for (let offset = index; offset < Math.min(count, index + stride); offset += 1) {
        if (Number.isFinite(series.values[offset])) { sum += series.values[offset]; sumTime += series.times[offset]; samples += 1; }
      }
      value = samples ? sum / samples : NaN;
      time = samples ? sumTime / samples : time;
    }
    if (!Number.isFinite(value)) { drawing = false; continue; }
    const px = x(time).toFixed(1);
    const py = y(value).toFixed(1);
    if (!drawing) path += `M${px} ${py}`;
    else path += stepped ? `L${px} ${previousY.toFixed(1)}L${px} ${py}` : `L${px} ${py}`;
    drawing = true;
    previousY = y(value);
  }
  return path;
}
