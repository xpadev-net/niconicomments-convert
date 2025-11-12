import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("api", {
  request: (...data: unknown[]) =>
    ipcRenderer.invoke("request", {
      data,
    }),
  onResponse: (fn: (...args: unknown[]) => void) => {
    ipcRenderer.on("response", fn);
  },
  remove: (fn: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener("response", fn);
  },
  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file);
  },
});
