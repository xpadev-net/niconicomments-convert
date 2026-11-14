import * as path from "node:path";
import { app, BrowserWindow, type WebContents } from "electron";

import type { ApiResponsesToRenderer } from "@/@types/response.renderer";

import { baseUrl } from "./context";
import { processingQueue } from "./queue";
import { store } from "./store";

let rendererWindow: BrowserWindow | undefined;
const createRendererWindow = (onFailure: (error: Error) => void): void => {
  const window = new BrowserWindow({
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
  rendererWindow = window;
  const fail = (error: Error): void => {
    if (rendererWindow === window) onFailure(error);
  };
  window.removeMenu();
  window.on("close", (e) => {
    if (processingQueue?.status === "processing") e.preventDefault();
  });
  window.on("closed", () =>
    fail(new Error("Renderer window closed unexpectedly")),
  );
  window.on("unresponsive", () => fail(new Error("Renderer is unresponsive")));
  window.webContents.on("render-process-gone", (_, details) => {
    fail(
      new Error(
        `Renderer process gone: ${details.reason} (${details.exitCode})`,
      ),
    );
  });
  void window.loadURL(`${baseUrl}?renderer`).catch(fail);

  if (!app.isPackaged) {
    window.webContents.openDevTools();
  }
};

const closeRendererWindow = (): void => {
  const window = rendererWindow;
  // Ignore lifecycle events and late IPC from a session being torn down.
  rendererWindow = undefined;
  if (window && !window.isDestroyed()) window.destroy();
};

const isRendererSender = (sender: WebContents): boolean =>
  !!rendererWindow &&
  !rendererWindow.isDestroyed() &&
  rendererWindow.webContents === sender;

const sendMessageToRenderer = (value: ApiResponsesToRenderer): void => {
  if (!rendererWindow || rendererWindow.isDestroyed()) return;
  rendererWindow.webContents.send("response", {
    ...value,
    target: "renderer",
  });
};

export {
  closeRendererWindow,
  createRendererWindow,
  isRendererSender,
  sendMessageToRenderer,
};
