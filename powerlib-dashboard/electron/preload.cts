import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("powerlib", {
  platform: process.platform
});
