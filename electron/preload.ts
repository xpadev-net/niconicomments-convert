import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  request: (...data) =>
    ipcRenderer.send("request", {
      data,
    }),
  onResponse: (fn: (...args) => void) => {
    ipcRenderer.on("response", fn);
  },
  remove: (fn: (...args) => void) => {
    ipcRenderer.removeListener("response", fn);
  },
});
