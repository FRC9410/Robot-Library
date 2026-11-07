import template from "./dashboard-template.json";
import { streamUrl } from "./dashboardModel";

export type FieldDimensions = { length: number; width: number };
export type DashboardSettings = FieldDimensions & { flip: boolean; urls: Record<string, string> };
// Keep existing laptop preferences, including field orientation and camera overrides.
export const dashboardSettingsKey = "powerlib.driveDisplay.v1";
export const defaultFieldDimensions: FieldDimensions = { length: template.field.lengthMeters, width: template.field.widthMeters };
let settings: DashboardSettings | undefined;
const listeners = new Set<() => void>();

export function validFieldDimensions(dimensions: FieldDimensions) {
  return Number.isFinite(dimensions.length) && dimensions.length > 0 && Number.isFinite(dimensions.width) && dimensions.width > 0;
}

function readSettings(): DashboardSettings {
  const defaults = { ...defaultFieldDimensions, flip: false, urls: {} };
  try {
    const value = JSON.parse(localStorage.getItem(dashboardSettingsKey) || "{}");
    if (!value || typeof value !== "object") return defaults;
    return {
      length: Number.isFinite(value.length) && value.length > 0 ? value.length : defaults.length,
      width: Number.isFinite(value.width) && value.width > 0 ? value.width : defaults.width,
      flip: value.flip === true,
      urls: value.urls && typeof value.urls === "object" ? Object.fromEntries(Object.entries(value.urls)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!streamUrl(entry[1]))) : {}
    };
  } catch { return defaults; }
}

export function getDashboardSettings() {
  return settings ??= readSettings();
}

export function saveFieldDimensions(dimensions: FieldDimensions) {
  if (!validFieldDimensions(dimensions)) throw new Error("Field dimensions must be positive, finite numbers.");
  const next = { ...getDashboardSettings(), length: dimensions.length, width: dimensions.width };
  localStorage.setItem(dashboardSettingsKey, JSON.stringify(next));
  settings = next;
  listeners.forEach(listener => listener());
}

export function subscribeDashboardSettings(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== dashboardSettingsKey && event.key !== null) return;
    settings = readSettings();
    listeners.forEach(notify => notify());
  };
  if (listeners.size === 1) {
    // Re-read when the first view mounts, in case preferences changed in another window.
    settings = readSettings();
    window.addEventListener("storage", onStorage);
    storageCleanup = () => window.removeEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) storageCleanup?.();
  };
}
let storageCleanup: (() => void) | undefined;
