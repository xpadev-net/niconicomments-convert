import { app, BrowserWindow } from "electron";
import * as path from "path";

import type { ApiResponsesToController } from "@/@types/response.controller";

import { baseUrl } from "./context";
import { processingQueue } from "./queue";

let controllerWindow: BrowserWindow;
const createControllerWindow = (): void => {
  controllerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  controllerWindow.removeMenu();
  controllerWindow.on("close", (e) => {
    if (processingQueue?.status === "processing") {
      e.preventDefault();
    }
  });

  const appURL = `${baseUrl}`;

  void controllerWindow.loadURL(appURL);

  if (!app.isPackaged) {
    controllerWindow.webContents.openDevTools();
  }
};
const sendMessageToController = (value: ApiResponsesToController): void => {
  controllerWindow.webContents.send("response", {
    ...value,
    target: "controller",
  });
};

export { createControllerWindow, sendMessageToController };
