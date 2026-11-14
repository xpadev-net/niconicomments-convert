import * as path from "node:path";
import { app, BrowserWindow } from "electron";

import type { ApiResponsesToRenderer } from "@/@types/response.renderer";

import { baseUrl } from "./context";
import { store } from "./store";

const closingWindows = new WeakSet<BrowserWindow>();

const createRendererWindow = (
  onFailure: (error: Error) => void,
): BrowserWindow => {
  const rendererWindow = new BrowserWindow({
    width: 640,
    height: 360,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: ["--ipc-role=renderer"],
      backgroundThrottling: false,
    },
    show: !!(store.get("showRendererWindow") ?? true),
  });
  try {
    rendererWindow.removeMenu();
    rendererWindow.on("close", (e) => {
      // The owning session destroys this window after converter cleanup.
      e.preventDefault();
    });
    const fail = (error: Error): void => {
      if (!closingWindows.has(rendererWindow)) onFailure(error);
    };
    rendererWindow.on("closed", () =>
      fail(new Error("Renderer window closed unexpectedly")),
    );
    rendererWindow.on("unresponsive", () =>
      fail(new Error("Renderer is unresponsive")),
    );
    rendererWindow.webContents.on("render-process-gone", (_, details) => {
      fail(
        new Error(
          `Renderer process gone: ${details.reason} (${details.exitCode})`,
        ),
      );
    });
    void rendererWindow.loadURL(`${baseUrl}?renderer`).catch(fail);

    if (!app.isPackaged) {
      rendererWindow.webContents.openDevTools();
    }
    return rendererWindow;
  } catch (error) {
    closeRendererWindow(rendererWindow);
    throw error;
  }
};

const closeRendererWindow = (rendererWindow: BrowserWindow): void => {
  closingWindows.add(rendererWindow);
  if (!rendererWindow.isDestroyed()) rendererWindow.destroy();
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

export { closeRendererWindow, createRendererWindow, sendMessageToRenderer };
