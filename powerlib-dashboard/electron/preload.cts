import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("powerlib", {
  platform: process.platform,
  readSubsystems: () => ipcRenderer.invoke("powerlib:read-subsystems"),
  saveSubsystems: (subsystems: unknown[], swerve?: unknown) =>
    ipcRenderer.invoke("powerlib:save-subsystems", subsystems, swerve),
  readBindings: () => ipcRenderer.invoke("powerlib:read-bindings"),
  saveBindings: (bindings: unknown[]) => ipcRenderer.invoke("powerlib:save-bindings", bindings),
  readTuningSelection: () => ipcRenderer.invoke("powerlib:read-tuning-selection"),
  saveTuningSelection: (selectedTopics: string[]) =>
    ipcRenderer.invoke("powerlib:save-tuning-selection", selectedTopics),
  saveTuningMonitorDrawerOpen: (open: boolean) =>
    ipcRenderer.invoke("powerlib:save-tuning-monitor-drawer-open", open),
  saveTuningSidebarExpandedSection: (section: "subsystem" | "command") =>
    ipcRenderer.invoke("powerlib:save-tuning-sidebar-expanded-section", section),
  readBindingConstants: () => ipcRenderer.invoke("powerlib:read-binding-constants"),
  updateSubsystemCode: () => ipcRenderer.invoke("powerlib:update-subsystem-code"),
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
  }
});
