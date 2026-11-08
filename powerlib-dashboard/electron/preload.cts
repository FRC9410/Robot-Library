import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("powerlib", {
  platform: process.platform,
  showAppMenu: (menuId: string, position: { x: number; y: number }) => ipcRenderer.invoke("powerlib:show-app-menu", menuId, position),
  readConstants: () => ipcRenderer.invoke("powerlib:read-constants"),
  readAutos: () => ipcRenderer.invoke("powerlib:read-autos"),
  saveAutos: (document: unknown, revision: string) => ipcRenderer.invoke("powerlib:save-autos", document, revision),
  generateAutos: (revision: string, sourceRevision: string, field: { length: number; width: number }) =>
    ipcRenderer.invoke("powerlib:generate-autos", revision, sourceRevision, field),
  readTuningSession: (connection: unknown) => ipcRenderer.invoke("powerlib:read-tuning-session", connection),
  saveTuningSession: (connection: unknown, values: unknown[]) => ipcRenderer.invoke("powerlib:save-tuning-session", connection, values),
  readLegacyMigration: () => ipcRenderer.invoke("powerlib:read-legacy-migration"),
  applyLegacyMigration: (revision: string, selected: string[], confirmed: boolean) => ipcRenderer.invoke("powerlib:apply-legacy-migration", revision, selected, confirmed),
  saveTunedSourceValues: (changes: unknown) => ipcRenderer.invoke("powerlib:save-tuned-source", changes),
  saveConstants: (id: string, source: string, constants: unknown[]) =>
    ipcRenderer.invoke("powerlib:save-constants", id, source, constants),
  readSubsystems: () => ipcRenderer.invoke("powerlib:read-subsystems"),
  readVisionConfig: () => ipcRenderer.invoke("powerlib:read-vision"),
  readStateConfig: () => ipcRenderer.invoke("powerlib:read-states"),
  saveStateConfig: (config: unknown) => ipcRenderer.invoke("powerlib:save-states", config),
  readLocalizationConfig: () => ipcRenderer.invoke("powerlib:read-localization"),
  saveLocalizationConfig: (config: unknown) => ipcRenderer.invoke("powerlib:save-localization", config),
  saveVisionConfig: (vision: unknown) => ipcRenderer.invoke("powerlib:save-vision", vision),
  saveSubsystems: (subsystems: unknown[], swerve?: unknown, revision?: string, deleted?: string[]) =>
    ipcRenderer.invoke("powerlib:save-subsystems", subsystems, swerve, revision, deleted),
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
  onMenuToggleNetworkTables: (callback: () => void) => {
    ipcRenderer.on("powerlib:menu-toggle-network-tables", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-toggle-network-tables", callback);
  },
  onMenuFieldLayout: (callback: (_event: unknown, id: string) => void) => {
    ipcRenderer.on("powerlib:menu-field-layout", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-field-layout", callback);
  },
  setFieldLayoutMenu: (id: string, uploadedAvailable?: boolean) => ipcRenderer.send("powerlib:set-field-layout-menu", id, uploadedAvailable),
  readUploadedField: () => ipcRenderer.invoke("powerlib:read-uploaded-field"),
  saveUploadedField: (field: unknown) => ipcRenderer.invoke("powerlib:save-uploaded-field", field),
  removeUploadedField: () => ipcRenderer.invoke("powerlib:remove-uploaded-field"),
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
