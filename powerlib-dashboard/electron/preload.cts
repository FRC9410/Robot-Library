import { contextBridge, ipcRenderer } from "electron";

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
  onMenuFieldLayout: (callback: (_event: unknown, id: string) => void) => {
    ipcRenderer.on("powerlib:menu-field-layout", callback);
    return () => ipcRenderer.removeListener("powerlib:menu-field-layout", callback);
  },
  setFieldLayoutMenu: (id: string) => ipcRenderer.send("powerlib:set-field-layout-menu", id)
});
