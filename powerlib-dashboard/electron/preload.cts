import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("powerlib", {
  platform: process.platform,
  readSubsystems: () => ipcRenderer.invoke("powerlib:read-subsystems")
});
