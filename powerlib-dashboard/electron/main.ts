import { app, BrowserWindow, ipcMain, shell } from "electron";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

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

function getRobotRoot(subsystemsJsonPath: string) {
  return path.dirname(subsystemsJsonPath);
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

ipcMain.handle("powerlib:save-subsystems", async (_event, subsystems: unknown[]) => {
  let targetPath = getSubsystemJsonCandidates()[1];

  for (const candidate of getSubsystemJsonCandidates()) {
    try {
      await fs.access(candidate);
      targetPath = candidate;
      break;
    } catch {
      // Keep looking. If none exist, write to the installed robot root candidate.
    }
  }

  const document = {
    subsystems: Array.isArray(subsystems) ? subsystems : []
  };

  await fs.writeFile(targetPath, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
  return {
    exists: true,
    path: targetPath,
    subsystems: document.subsystems
  };
});

ipcMain.handle("powerlib:update-subsystem-code", async () => {
  const subsystemsPath = getSubsystemJsonCandidates()[1];
  let targetPath = subsystemsPath;

  for (const candidate of getSubsystemJsonCandidates()) {
    try {
      await fs.access(candidate);
      targetPath = candidate;
      break;
    } catch {
      // Keep looking.
    }
  }

  const robotRoot = getRobotRoot(targetPath);
  const scriptCandidates = [
    path.join(robotRoot, "power-tool", "scripts", "generate-subsystem.ps1"),
    path.join(robotRoot, "powerlib-dashboard", "scripts", "generate-subsystem.ps1"),
    path.join(robotRoot, ".robot-library-generate-subsystem.ps1")
  ];
  let scriptPath = scriptCandidates[0];

  for (const candidate of scriptCandidates) {
    try {
      await fs.access(candidate);
      scriptPath = candidate;
      break;
    } catch {
      // Keep looking for legacy installs.
    }
  }

  try {
    await fs.access(scriptPath);
  } catch {
    throw new Error(`Missing ${scriptCandidates[0]}. Install PowerLib helper scripts first.`);
  }

  const { stdout, stderr } = await execFileAsync(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", scriptPath, "-UpdateSubsystems", "-SubsystemsJson", targetPath],
    {
      cwd: robotRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4
    }
  );

  return {
    stdout,
    stderr
  };
});

ipcMain.handle("powerlib:update-power-tool", async () => {
  const robotRoot = path.resolve(process.cwd(), "..");
  const updaterCandidates = [
    path.join(robotRoot, "power-tool", "scripts", "update-power-tool.ps1"),
    path.join(process.cwd(), "scripts", "update-power-tool.ps1")
  ];
  let updaterPath = updaterCandidates[0];

  for (const candidate of updaterCandidates) {
    try {
      await fs.access(candidate);
      updaterPath = candidate;
      break;
    } catch {
      // Keep looking.
    }
  }

  try {
    await fs.access(updaterPath);
  } catch {
    throw new Error(`Missing ${updaterCandidates[0]}. Reinstall Power Tool to add the updater.`);
  }

  const tempUpdaterPath = path.join(robotRoot, "build", "power-tool-update.ps1");
  await fs.mkdir(path.dirname(tempUpdaterPath), { recursive: true });
  await fs.copyFile(updaterPath, tempUpdaterPath);

  const child = spawn(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", tempUpdaterPath, "-ParentPid", String(process.pid)],
    {
      cwd: robotRoot,
      detached: true,
      stdio: "ignore",
      windowsHide: false
    }
  );
  child.unref();

  app.quit();
  return { started: true };
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: "Power Tool",
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
