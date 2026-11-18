import * as path from "node:path";
import type { WebContents } from "electron";
import { app, BrowserWindow } from "electron";

import type { ApiResponsesToController } from "@/@types/response.controller.js";

import { baseUrl } from "./context.js";
import { isConversionProcessing } from "./queue.js";

let controllerWindow: BrowserWindow;
const createControllerWindow = (): void => {
  controllerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: ["--ipc-role=controller"],
    },
  });
  controllerWindow.removeMenu();
  controllerWindow.on("close", (e) => {
    if (isConversionProcessing()) {
      e.preventDefault();
    }
  });

  const appURL = `${baseUrl}`;

  void controllerWindow.loadURL(appURL);

  if (!app.isPackaged) {
    controllerWindow.webContents.openDevTools();
  }
};
const isControllerSender = (sender: WebContents): boolean =>
  !!controllerWindow &&
  !controllerWindow.isDestroyed() &&
  controllerWindow.webContents === sender;

const sendMessageToController = (value: ApiResponsesToController): void => {
  controllerWindow.webContents.send("response", {
    ...value,
    target: "controller",
  });
};

export { createControllerWindow, isControllerSender, sendMessageToController };
