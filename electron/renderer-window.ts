import * as path from "node:path";
import { app, BrowserWindow } from "electron";

import type { ApiResponsesToRenderer } from "@/@types/response.renderer";

import { baseUrl } from "./context";
import { processingQueue } from "./queue";
import { store } from "./store";

let rendererWindow: BrowserWindow;
let isOpen = false;
const createRendererWindow = (): void => {
  rendererWindow = new BrowserWindow({
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
  isOpen = true;
  rendererWindow.removeMenu();
  rendererWindow.on("close", (e) => {
    if (processingQueue?.status === "processing") {
      e.preventDefault();
      return;
    }
    isOpen = false;
  });
  void rendererWindow.loadURL(`${baseUrl}?renderer`);

  if (!app.isPackaged) {
    rendererWindow.webContents.openDevTools();
  }
};

const sendMessageToRenderer = (value: ApiResponsesToRenderer): void => {
  if (!isOpen) return;
  rendererWindow?.webContents.send("response", {
    ...value,
    target: "renderer",
  });
};

export { createRendererWindow, sendMessageToRenderer };
