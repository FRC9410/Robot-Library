import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("powerlib", {
  platform: process.platform,
  readConstants: () => ipcRenderer.invoke("powerlib:read-constants"),
  saveConstants: (id: string, source: string, constants: unknown[]) =>
    ipcRenderer.invoke("powerlib:save-constants", id, source, constants),
  readSubsystems: () => ipcRenderer.invoke("powerlib:read-subsystems"),
  saveSubsystems: (subsystems: unknown[], swerve?: unknown) =>
    ipcRenderer.invoke("powerlib:save-subsystems", subsystems, swerve),
  updateSubsystemCode: () => ipcRenderer.invoke("powerlib:update-subsystem-code"),
  updateInstallSection: (section: string) => ipcRenderer.invoke("powerlib:update-install-section", section),
  updatePowerTool: () => ipcRenderer.invoke("powerlib:update-power-tool"),
  openLog: () => ipcRenderer.invoke("powerlib:open-log"),
  openLogPath: (filePath: string) => ipcRenderer.invoke("powerlib:open-log-path", filePath),
  openLogFiles: (filePaths: string[]) => ipcRenderer.invoke("powerlib:open-log-files", filePaths),
  defaultLogsFolder: () => ipcRenderer.invoke("powerlib:default-logs-folder"),
  listLogs: (folder: string) => ipcRenderer.invoke("powerlib:list-logs", folder),
  chooseLogsFolder: () => ipcRenderer.invoke("powerlib:choose-logs-folder"),
  findRobot: () => ipcRenderer.invoke("powerlib:find-robot"),
  listRobotLogs: () => ipcRenderer.invoke("powerlib:list-robot-logs"),
  downloadRobotLogs: (downloads: { remotePath: string; localFolder: string }[], localRoot: string) =>
    ipcRenderer.invoke("powerlib:download-robot-logs", downloads, localRoot),
  deleteRobotLogs: (remotePaths: string[]) => ipcRenderer.invoke("powerlib:delete-robot-logs", remotePaths),
  onRobotDownloadProgress: (callback: (_event: unknown, progress: { done: number; total: number; file: string }) => void) => {
    ipcRenderer.on("powerlib:robot-download-progress", callback);
    return () => ipcRenderer.removeListener("powerlib:robot-download-progress", callback);
  },
  readDriveMotorIds: () => ipcRenderer.invoke("powerlib:read-drive-motor-ids"),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
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
  }
});
