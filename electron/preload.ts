import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld('api', {
  request: (...data) => ipcRenderer.send("request", {
    data,
  }),
  onResponse: (fn) => {
    // Deliberately strip event as it includes `sender`
    console.log("hoge");
    ipcRenderer.on('response', (event, ...args) => fn(...args));
  }
});