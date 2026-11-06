// Settings the page keeps in localStorage under "powerlib." (connection, field layout, column widths,
// recorded runs and so on), mirrored to one file so every way of running Power Tool shares them.
// The dev server (http://127.0.0.1:5173) and the built app (file://) are different origins, so each
// has its own localStorage; without this file they remember different things.
import fsSync from "node:fs";
import path from "node:path";

export const rendererSettingsPrefix = "powerlib.";
export const rendererSettingsFileName = "power-tool-settings.json";

export type RendererSettings = Record<string, string>;

/** Keeps only "powerlib." keys with string values; anything else in the file or from the page is dropped. */
export function cleanRendererSettings(value: unknown): RendererSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => entry[0].startsWith(rendererSettingsPrefix) && typeof entry[1] === "string"));
}

/** The saved settings, or null when there is no readable file yet. */
export function readRendererSettings(file: string): RendererSettings | null {
  try {
    return cleanRendererSettings(JSON.parse(fsSync.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** Writes through a temporary file, so a crash mid-write never leaves half a file. */
export function writeRendererSettings(file: string, settings: RendererSettings) {
  fsSync.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fsSync.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`);
  fsSync.renameSync(temporary, file);
}

/**
 * The first time a way of running Power Tool joins the file, its own settings are added to it.
 * Where both have a value, the file's wins, since it may already be in use elsewhere.
 */
export function joinRendererSettings(file: string, local: unknown): RendererSettings {
  const joined = { ...cleanRendererSettings(local), ...(readRendererSettings(file) ?? {}) };
  writeRendererSettings(file, joined);
  return joined;
}
