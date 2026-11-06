import { contextBridge, ipcRenderer } from "electron";

// Page settings ("powerlib." keys in localStorage) are shared through one file in the main process
// (electron/rendererSettings.ts): the dev server and the built app are different origins, each with
// its own localStorage. This runs before the page's code, so the page only ever sees the shared values.
// Kept in this file because a sandboxed preload can't load other local modules.
// tsconfig.electron.json has no DOM types; the preload does run in the page, so it has `window`.
declare const window: { addEventListener(type: "pagehide", listener: () => void): void };
const settingsPrefix = "powerlib.";
// Not a "powerlib." key, so it stays with this origin: whether its settings have joined the file yet.
const settingsJoinedKey = "power-tool:settings-joined";

function pageSettings() {
  const settings: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(settingsPrefix)) settings[key] = localStorage.getItem(key) ?? "";
  }
  return Object.fromEntries(Object.entries(settings).sort(([a], [b]) => a.localeCompare(b)));
}

/** Makes localStorage hold exactly `settings` for "powerlib." keys. */
function usePageSettings(settings: Record<string, string>) {
  for (const key of Object.keys(pageSettings())) if (!(key in settings)) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(settings)) localStorage.setItem(key, value);
}

let savedSettings: string | null = null;
try {
  // First time here: add this origin's own settings to the file instead of losing them.
  const shared = localStorage.getItem(settingsJoinedKey) === "true"
    ? ipcRenderer.sendSync("powerlib:settings-read") ?? ipcRenderer.sendSync("powerlib:settings-join", pageSettings())
    : ipcRenderer.sendSync("powerlib:settings-join", pageSettings());
  if (shared) {
    usePageSettings(shared);
    localStorage.setItem(settingsJoinedKey, "true");
    savedSettings = JSON.stringify(pageSettings());
  }
} catch {
  // Without the file the page still works on its own localStorage.
}

/** Sends the page's settings to the file when they've changed since the last save. */
function saveSettings() {
  if (savedSettings === null) return;
  try {
    const settings = pageSettings();
    const json = JSON.stringify(settings);
    if (json === savedSettings) return;
    savedSettings = json;
    ipcRenderer.send("powerlib:settings-write", settings);
  } catch {
    // Try again on the next check.
  }
}
// The page writes localStorage directly, so check for changes once a second and on the way out.
setInterval(saveSettings, 1000);
window.addEventListener("pagehide", saveSettings);

contextBridge.exposeInMainWorld("powerlib", {
  platform: process.platform,
  readConstants: () => ipcRenderer.invoke("powerlib:read-constants"),
  saveConstants: (id: string, source: string, constants: unknown[]) =>
    ipcRenderer.invoke("powerlib:save-constants", id, source, constants),
  readSubsystems: () => ipcRenderer.invoke("powerlib:read-subsystems"),
  saveSubsystems: (subsystems: unknown[], swerve?: unknown) =>
    ipcRenderer.invoke("powerlib:save-subsystems", subsystems, swerve),
  updateSubsystemCode: () => ipcRenderer.invoke("powerlib:update-subsystem-code"),
  readAutos: () => ipcRenderer.invoke("powerlib:read-autos"),
  saveAutos: (document: unknown) => ipcRenderer.invoke("powerlib:save-autos", document),
  updateAutoCode: (document: unknown, javaSource: string) =>
    ipcRenderer.invoke("powerlib:update-auto-code", document, javaSource),
  updateInstallSection: (section: string) => ipcRenderer.invoke("powerlib:update-install-section", section),
  updatePowerTool: () => ipcRenderer.invoke("powerlib:update-power-tool"),
  onMenuConnectionSettings: (callback: () => void) => {
    ipcRenderer.on("powerlib:menu-connection-settings", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-connection-settings", callback);
  },
  onMenuUpdateSubsystemCode: (callback: () => void) => {
    ipcRenderer.on("powerlib:menu-update-subsystem-code", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-update-subsystem-code", callback);
  },
  onMenuUpdateInstallSection: (callback: (_event: unknown, section: string) => void) => {
    ipcRenderer.on("powerlib:menu-update-install-section", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-update-install-section", callback);
  },
  onMenuUpdatePowerTool: (callback: () => void) => {
    ipcRenderer.on("powerlib:menu-update-power-tool", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-update-power-tool", callback);
  },
  onMenuAutoShortcuts: (callback: () => void) => {
    ipcRenderer.on("powerlib:menu-auto-shortcuts", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-auto-shortcuts", callback);
  },
  onMenuFieldLayout: (callback: (_event: unknown, id: string) => void) => {
    ipcRenderer.on("powerlib:menu-field-layout", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-field-layout", callback);
  },
  setFieldLayoutMenu: (id: string) => ipcRenderer.send("powerlib:set-field-layout-menu", id)
});
