import * as path from "node:path";
import { app, BrowserWindow } from "electron";

import type { ApiResponsesToRenderer } from "@/@types/response.renderer";

import { baseUrl } from "./context";
import { store } from "./store";

const createRendererWindow = (): BrowserWindow => {
  const rendererWindow = new BrowserWindow({
    width: 640,
    height: 360,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
    show: !!(store.get("showRendererWindow") ?? true),
  });
  rendererWindow.removeMenu();
  rendererWindow.on("close", (e) => {
    // The owning session destroys this window after converter cleanup.
    e.preventDefault();
  });
  void rendererWindow.loadURL(`${baseUrl}?renderer`);

  if (!app.isPackaged) {
    rendererWindow.webContents.openDevTools();
  }
  return rendererWindow;
};

const sendMessageToRenderer = (
  rendererWindow: BrowserWindow,
  value: ApiResponsesToRenderer,
): void => {
  if (rendererWindow.isDestroyed()) return;
  rendererWindow?.webContents.send("response", {
    ...value,
    target: "renderer",
  });
};

export { createRendererWindow, sendMessageToRenderer };
