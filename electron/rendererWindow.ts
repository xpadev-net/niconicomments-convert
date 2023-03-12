import { apiResponsesToRenderer } from "@/@types/response.renderer";
import { app, BrowserWindow } from "electron";
import * as path from "path";
import { baseUrl } from "./context";

let rendererWindow: BrowserWindow;
let isOpen = false;
const createRendererWindow = () => {
  rendererWindow = new BrowserWindow({
    width: 640,
    height: 360,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });
  isOpen = true;
  rendererWindow.removeMenu();
  rendererWindow.on("close", () => {
    isOpen = false;
  });
  void rendererWindow.loadURL(`${baseUrl}?renderer`);

  if (!app.isPackaged) {
    rendererWindow.webContents.openDevTools();
  }
};
const sendMessageToRenderer = (value: apiResponsesToRenderer) => {
  if (!isOpen) return;
  rendererWindow.webContents.send("response", { ...value, target: "renderer" });
};

export { createRendererWindow, sendMessageToRenderer };
