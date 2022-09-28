import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  request: (...data) =>
    ipcRenderer.send("request", {
      data,
    }),
  onResponse: (fn) => {
    ipcRenderer.on("response", (event, ...args) => fn(...args));
  },
});
