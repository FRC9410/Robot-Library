import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function getSubsystemJsonCandidates() {
  return Array.from(
    new Set([
      path.resolve(process.cwd(), "powerlib-subsystems.json"),
      path.resolve(process.cwd(), "..", "powerlib-subsystems.json"),
      path.resolve(app.getAppPath(), "powerlib-subsystems.json"),
      path.resolve(app.getAppPath(), "..", "powerlib-subsystems.json")
    ])
  );
}

ipcMain.handle("powerlib:read-subsystems", async () => {
  for (const candidate of getSubsystemJsonCandidates()) {
    try {
      const raw = await fs.readFile(candidate, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        exists: true,
        path: candidate,
        subsystems: Array.isArray(parsed.subsystems) ? parsed.subsystems : []
      };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "ENOENT") {
        return {
          exists: false,
          path: candidate,
          subsystems: [],
          error: error instanceof Error ? error.message : "Could not read powerlib-subsystems.json."
        };
      }
    }
  }

  return {
    exists: false,
    path: getSubsystemJsonCandidates()[1],
    subsystems: []
  };
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: "PowerLib Dashboard",
    backgroundColor: "#f4f5f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    window.loadFile(path.join(__dirname, "../dist-renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
