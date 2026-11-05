import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readConstantsFiles, saveConstantsFile } from "./constantsFiles.js";
import { generatedJsonPath } from "./projectPaths.js";
import { convertHoot, sessionSiblings } from "./owlet.js";
import { deleteRobotLogs, downloadRobotLogs, findRobot, isRobotLogPath, listRobotLogs } from "./robotLogs.js";
import type { RobotDownload } from "./robotLogs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createAppMenu(window: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [{ role: "about" as const }, { type: "separator" as const }, { role: "quit" as const }]
          }
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Connection Settings",
          click: () => window.webContents.send("powerlib:menu-connection-settings")
        },
        { type: "separator" },
        {
          label: "Update Code",
          click: () => window.webContents.send("powerlib:menu-update-subsystem-code")
        },
        { type: "separator" },
        {
          label: "Update PowerLib Library Files",
          click: () => window.webContents.send("powerlib:menu-update-install-section", "lib")
        },
        {
          label: "Update Vendor Dependencies",
          click: () => window.webContents.send("powerlib:menu-update-install-section", "vendordeps")
        },
        {
          label: "Update Power Tool",
          click: () => window.webContents.send("powerlib:menu-update-power-tool")
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }]
    },
    {
      label: "Help",
      submenu: []
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function getSubsystemJsonCandidates() {
  return [await generatedJsonPath(getDetectedRobotRoot(), "powerlib-subsystems.json")];
}

function pathExistsSync(candidate: string) {
  try {
    return fsSync.existsSync(candidate);
  } catch {
    return false;
  }
}

function getAncestorCandidates(start: string) {
  const candidates: string[] = [];
  let current = path.resolve(start);

  for (let index = 0; index < 8; index += 1) {
    candidates.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return candidates;
}

function getDetectedRobotRoot() {
  const starts = [process.cwd(), app.getAppPath(), __dirname];
  const candidates = Array.from(new Set(starts.flatMap((start) => getAncestorCandidates(start))));

  for (const candidate of candidates) {
    const normalized = path.basename(candidate).toLowerCase() === "power-tool" ? path.dirname(candidate) : candidate;
    if (
      pathExistsSync(path.join(normalized, "build.gradle")) ||
      pathExistsSync(path.join(normalized, "settings.gradle")) ||
      pathExistsSync(path.join(normalized, "src", "main", "java")) ||
      pathExistsSync(path.join(normalized, "power-tool", "scripts", "generate-subsystem.ps1"))
    ) {
      return normalized;
    }
  }

  const cwd = path.resolve(process.cwd());
  return path.basename(cwd).toLowerCase() === "power-tool" ? path.dirname(cwd) : cwd;
}

function getPowerToolRootCandidates() {
  const robotRoot = getDetectedRobotRoot();
  return Array.from(
    new Set([
      path.resolve(robotRoot, "power-tool"),
      path.resolve(process.cwd(), "power-tool"),
      path.resolve(process.cwd()),
      path.resolve(app.getAppPath()),
      path.resolve(app.getAppPath(), ".."),
      path.resolve(__dirname, "..")
    ])
  );
}

ipcMain.handle("powerlib:read-subsystems", async () => {
  for (const candidate of await getSubsystemJsonCandidates()) {
    try {
      const raw = await fs.readFile(candidate, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        exists: true,
        path: candidate,
        subsystems: Array.isArray(parsed.subsystems) ? parsed.subsystems : [],
        swerve: parsed && typeof parsed.swerve === "object" && !Array.isArray(parsed.swerve) ? parsed.swerve : {}
      };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "ENOENT") {
        return {
          exists: false,
          path: candidate,
          subsystems: [],
          swerve: {},
          error: error instanceof Error ? error.message : "Could not read powerlib-subsystems.json."
        };
      }
    }
  }

  return {
    exists: false,
    path: (await getSubsystemJsonCandidates())[0],
    subsystems: [],
    swerve: {}
  };
});

ipcMain.handle("powerlib:save-subsystems", async (_event, subsystems: unknown[], swerve?: unknown) => {
  let targetPath = (await getSubsystemJsonCandidates())[0];
  let existingDocument: Record<string, unknown> = {};

  for (const candidate of await getSubsystemJsonCandidates()) {
    try {
      await fs.access(candidate);
      targetPath = candidate;
      try {
        const raw = await fs.readFile(candidate, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          existingDocument = parsed as Record<string, unknown>;
        }
      } catch {
        existingDocument = {};
      }
      break;
    } catch {
      // Keep looking. If none exist, write to the installed robot root candidate.
    }
  }

  const document = {
    ...existingDocument,
    swerve: swerve !== undefined ? swerve : (existingDocument.swerve ?? {}),
    subsystems: Array.isArray(subsystems) ? subsystems : []
  };

  await fs.writeFile(targetPath, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
  return {
    exists: true,
    path: targetPath,
    subsystems: document.subsystems,
    swerve: document.swerve ?? {}
  };
});

async function getConstantsRobotRoot() {
  return getDetectedRobotRoot();
}

ipcMain.handle("powerlib:read-constants", async () => readConstantsFiles(await getConstantsRobotRoot()));
ipcMain.handle("powerlib:save-constants", async (_event, id, source, constants) =>
  saveConstantsFile(await getConstantsRobotRoot(), id, source, constants));

ipcMain.handle("powerlib:update-subsystem-code", async () => {
  const robotRoot = getDetectedRobotRoot();
  const subsystemsPath = await generatedJsonPath(robotRoot, "powerlib-subsystems.json");
  let targetPath = subsystemsPath;

  for (const candidate of await getSubsystemJsonCandidates()) {
    try {
      await fs.access(candidate);
      targetPath = candidate;
      break;
    } catch {
      // Keep looking.
    }
  }

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
    throw new Error(`Missing ${scriptCandidates[0]}. Reinstall or update Power Tool to add PowerLib scripts.`);
  }

  const { stdout, stderr } = await execFileAsync(
    "powershell",
    [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-UpdateSubsystems",
      "-SubsystemsJson",
      targetPath
    ],
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

ipcMain.handle("powerlib:update-install-section", async (_event, section: string) => {
  const robotRoot = getDetectedRobotRoot();
  const installerPath = path.join(robotRoot, "power-tool", "scripts", "install.ps1");
  const repoRefPath = path.join(robotRoot, ".powerlib-repo-ref");
  let repoRef = "main";
  try {
    const savedRepoRef = (await fs.readFile(repoRefPath, "utf-8")).trim();
    if (savedRepoRef) {
      repoRef = savedRepoRef;
    }
  } catch {
    // Default to main for older installs without a saved repo ref.
  }
  await fs.mkdir(path.dirname(installerPath), { recursive: true });

  const installScriptCandidates = [
    installerPath,
    path.join(robotRoot, "power-tool", "install.ps1"),
    path.join(robotRoot, "install.ps1")
  ];
  const localLibraryInstallScript = path.resolve(app.getAppPath(), "..", "install.ps1");

  let installScriptContent: string | null = null;
  for (const candidate of installScriptCandidates) {
    try {
      installScriptContent = await fs.readFile(candidate, "utf-8");
      break;
    } catch {
      // Keep looking.
    }
  }

  if (!installScriptContent && pathExistsSync(localLibraryInstallScript)) {
    installScriptContent = await fs.readFile(localLibraryInstallScript, "utf-8");
  }

  if (installScriptContent) {
    await fs.writeFile(installerPath, installScriptContent, "utf-8");
  } else {
    const response = await fetch(`https://raw.githubusercontent.com/FRC9410/Robot-Library/${repoRef}/install.ps1`);
    if (!response.ok) throw new Error(`Could not download the PowerLib installer: ${response.status}`);
    await fs.writeFile(installerPath, await response.text(), "utf-8");
  }

  const sectionArgs: Record<string, string[]> = {
    lib: [
      "-PpowerlibInstallLib=true",
      "-PpowerlibInstallTemplates=false",
      "-PpowerlibInstallVendordeps=false",
      "-PpowerlibInstallDashboard=false"
    ],
    vendordeps: [
      "-PpowerlibInstallLib=false",
      "-PpowerlibInstallTemplates=false",
      "-PpowerlibInstallVendordeps=true",
      "-PpowerlibInstallDashboard=false"
    ]
  };

  const args = sectionArgs[section];
  if (!args) {
    throw new Error(`Unknown PowerLib update section: ${section}`);
  }

  const { stdout, stderr } = await execFileAsync(
    "powershell",
    [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      installerPath,
      "-RepoRef",
      repoRef,
      "-PpowerlibInteractive=false",
      ...args
    ],
    {
      cwd: robotRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8
    }
  );

  return { stdout, stderr };
});

ipcMain.handle("powerlib:update-power-tool", async () => {
  const updaterCandidates = getPowerToolRootCandidates().map((candidate) =>
    path.join(candidate, "scripts", "update-power-tool.ps1")
  );
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

  const toolRoot = path.dirname(path.dirname(updaterPath));
  const robotRoot = path.dirname(toolRoot);
  const tempUpdaterPath = path.join(toolRoot, "scripts", "power-tool-update.ps1");
  const tempUpdaterRunnerPath = path.join(toolRoot, "scripts", "run-power-tool-update.ps1");
  await fs.mkdir(path.dirname(tempUpdaterPath), { recursive: true });
  await fs.copyFile(updaterPath, tempUpdaterPath);

  await fs.writeFile(
    tempUpdaterRunnerPath,
    [
      "$ErrorActionPreference = 'Stop'",
      "try {",
      `  & '${tempUpdaterPath.replace(/'/g, "''")}' -ParentPid ${process.pid}`,
      "  if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) {",
      "    throw \"Power Tool updater exited with code $LASTEXITCODE.\"",
      "  }",
      "  exit 0",
      "} catch {",
      "  Write-Host ''",
      "  Write-Host $_",
      "  Write-Host ''",
      "  Write-Host 'Power Tool update failed. Press Enter to close.'",
      "  [Console]::ReadLine() | Out-Null",
      "  exit 1",
      "}"
    ].join("\r\n"),
    "utf-8"
  );

  const child = spawn(
    "cmd.exe",
    [
      "/c",
      "start",
      "Power Tool Update",
      "powershell",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      tempUpdaterRunnerPath
    ],
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

/** Folders that may hold CTRE's Owlet; AdvantageScope keeps every version it has downloaded. */
function owletDirectories() {
  return Array.from(new Set([
    path.join(getDetectedRobotRoot(), "power-tool", "tools"),
    path.join(getDetectedRobotRoot(), "tools"),
    ...getPowerToolRootCandidates().map((candidate) => path.join(candidate, "tools")),
    path.join(app.getPath("appData"), "AdvantageScope", "owlet")
  ]));
}

const isLogPath = (filePath: unknown): filePath is string => typeof filePath === "string" && /\.(wpilog|hoot)$/i.test(filePath);

/** Reads one session's files in order; each .hoot is converted to .wpilog through Owlet first. */
async function readLogFiles(filePaths: string[]) {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-log-"));
  try {
    const files = [];
    let converted = false;
    for (const filePath of filePaths) {
      const name = path.basename(filePath);
      if (path.extname(filePath).toLowerCase() !== ".hoot") {
        files.push({ name, bytes: await fs.readFile(filePath) });
        continue;
      }
      const outputPath = path.join(outputDirectory, `${path.basename(name, path.extname(name))}.wpilog`);
      await convertHoot(filePath, outputPath, owletDirectories(), process.env.POWERLIB_OWLET);
      files.push({ name, bytes: await fs.readFile(outputPath) });
      converted = true;
    }
    return { canceled: false as const, name: path.basename(filePaths[0]), path: filePaths[0], converted, files };
  } finally {
    await fs.rm(outputDirectory, { recursive: true, force: true });
  }
}

/** A .hoot opens with every .hoot from the same session (one per CAN bus). */
async function readLogFile(filePath: string) {
  if (path.extname(filePath).toLowerCase() !== ".hoot") return readLogFiles([filePath]);
  const directory = path.dirname(filePath);
  const name = path.basename(filePath);
  const siblings = sessionSiblings(name, await fs.readdir(directory).catch(() => [name]));
  return readLogFiles(siblings.map((sibling) => path.join(directory, sibling)));
}

/** Every .hoot and .wpilog under `folder` (a few levels deep), for the Logs tab's list. */
async function listLogFiles(folder: string) {
  const files: { path: string; folder: string; name: string; modifiedMs: number; size: number }[] = [];
  async function walk(directory: string, depth: number) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory() && depth < 4) await walk(full, depth + 1);
      else if (entry.isFile() && isLogPath(entry.name) && files.length < 5000) {
        const stats = await fs.stat(full).catch(() => null);
        if (stats) files.push({ path: full, folder: path.relative(folder, directory), name: entry.name, modifiedMs: stats.mtimeMs, size: stats.size });
      }
    }
  }
  const exists = await fs.stat(folder).then((stats) => stats.isDirectory()).catch(() => false);
  if (exists) await walk(folder, 0);
  return { folder, exists, files };
}

/** Swerve motor CAN IDs from the robot's TunerConstants.java (`k<Module>DriveMotorId` / `k<Module>SteerMotorId`), so logs can group them as Drive. */
async function readDriveMotorIds() {
  const robotRoot = getDetectedRobotRoot();
  const candidates = ["constants", "generated", ""].map((folder) => path.join(robotRoot, "src", "main", "java", "frc", "robot", folder, "TunerConstants.java"));
  for (const candidate of candidates) {
    try {
      const source = await fs.readFile(candidate, "utf-8");
      const ids = Array.from(source.matchAll(/\bk\w*(?:Drive|Steer)MotorId\s*=\s*(\d+)\s*;/g), (match) => Number(match[1]));
      if (ids.length) return Array.from(new Set(ids));
    } catch {
      // Keep looking.
    }
  }
  return [];
}

ipcMain.handle("powerlib:read-drive-motor-ids", async () => readDriveMotorIds());

ipcMain.handle("powerlib:open-log", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    title: "Open robot log",
    properties: ["openFile"],
    filters: [
      { name: "Robot logs", extensions: ["wpilog", "hoot"] },
      { name: "All files", extensions: ["*"] }
    ]
  };
  const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return { canceled: true as const };
  return readLogFile(result.filePaths[0]);
});

ipcMain.handle("powerlib:open-log-path", async (_event, filePath: string) => {
  if (!isLogPath(filePath)) {
    throw new Error("Only .wpilog and .hoot files can be opened.");
  }
  return readLogFile(filePath);
});

ipcMain.handle("powerlib:open-log-files", async (_event, filePaths: unknown) => {
  if (!Array.isArray(filePaths) || filePaths.length === 0 || !filePaths.every(isLogPath)) {
    throw new Error("Only .wpilog and .hoot files can be opened.");
  }
  return readLogFiles(filePaths);
});

ipcMain.handle("powerlib:default-logs-folder", () => path.join(app.getPath("documents"), "Power Tool", "Logs"));

ipcMain.handle("powerlib:list-logs", async (_event, folder: unknown) => {
  if (typeof folder !== "string" || !folder) throw new Error("Pick a logs folder first.");
  return listLogFiles(folder);
});

ipcMain.handle("powerlib:find-robot", async () => findRobot());
ipcMain.handle("powerlib:list-robot-logs", async () => listRobotLogs());

ipcMain.handle("powerlib:download-robot-logs", async (event, downloads: unknown, localRoot: unknown) => {
  const valid = Array.isArray(downloads) && downloads.every((item) => typeof item?.remotePath === "string" && isLogPath(item.remotePath)
    && typeof item?.localFolder === "string" && !path.isAbsolute(item.localFolder) && !item.localFolder.split(/[\\/]/).includes(".."));
  if (!valid || typeof localRoot !== "string" || !localRoot) throw new Error("Pick a logs folder and some logs to download.");
  return downloadRobotLogs(downloads as RobotDownload[], localRoot,
    (progress) => { if (!event.sender.isDestroyed()) event.sender.send("powerlib:robot-download-progress", progress); });
});

ipcMain.handle("powerlib:delete-robot-logs", async (_event, remotePaths: unknown) => {
  const valid = Array.isArray(remotePaths) && remotePaths.length > 0
    && remotePaths.every((item) => typeof item === "string" && isRobotLogPath(item));
  if (!valid) throw new Error("Pick some robot logs to delete.");
  return deleteRobotLogs(remotePaths as string[]);
});

ipcMain.handle("powerlib:choose-logs-folder", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = { title: "Choose the logs folder", properties: ["openDirectory", "createDirectory"] };
  const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
  return result.canceled ? null : result.filePaths[0] ?? null;
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: "Power Tool",
    backgroundColor: "#0d0d0d",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: "question",
      buttons: ["Keep Editing", "Discard Changes"],
      defaultId: 0,
      cancelId: 0,
      message: "Discard unsaved constants?",
      detail: "Closing or reloading Power Tool will discard your unsaved constant edits."
    });
    if (choice === 1) event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  createAppMenu(window);

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
