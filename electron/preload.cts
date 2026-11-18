import type { IpcRendererEvent } from "electron";
import { contextBridge, ipcRenderer, webUtils } from "electron";

import type { Request } from "@/@types/ipc.js";
import type { ApiResponseType } from "@/@types/types.js";

// Assigned by main when the window is created; page URL/query cannot change it.
const role = process.argv
  .find((arg) => arg.startsWith("--ipc-role="))
  ?.slice("--ipc-role=".length);
type Callback = (_: unknown, data: ApiResponseType) => void;
const listeners = new Map<
  Callback,
  (event: IpcRendererEvent, data: ApiResponseType) => void
>();
const responses = {
  onResponse: (callback: Callback): void => {
    if (listeners.has(callback)) return;
    const listener = (
      _event: IpcRendererEvent,
      data: ApiResponseType,
    ): void => {
      if (data && data.target === role) callback(undefined, data);
    };
    listeners.set(callback, listener);
    ipcRenderer.on("response", listener);
  },
  remove: (callback: Callback): void => {
    const listener = listeners.get(callback);
    if (!listener) return;
    ipcRenderer.removeListener("response", listener);
    listeners.delete(callback);
  },
};
const request = async (value: Request): Promise<unknown> => {
  if (!value || value.host !== role) throw new Error("IPC role mismatch");
  return ipcRenderer.invoke("request", value);
};

if (role === "controller") {
  contextBridge.exposeInMainWorld("api", {
    ...responses,
    request,
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  });
} else if (role === "renderer") {
  contextBridge.exposeInMainWorld("api", { ...responses, request });
} else if (role === "downloader") {
  contextBridge.exposeInMainWorld("api", responses);
}
