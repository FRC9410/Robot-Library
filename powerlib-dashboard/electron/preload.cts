import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("powerlib", {
  platform: process.platform,
  readSubsystems: () => ipcRenderer.invoke("powerlib:read-subsystems"),
  saveSubsystems: (subsystems: unknown[]) => ipcRenderer.invoke("powerlib:save-subsystems", subsystems),
  updateSubsystemCode: () => ipcRenderer.invoke("powerlib:update-subsystem-code")
});
