import { app, BrowserWindow } from "electron";
import * as path from "path";

let rendererWindow: BrowserWindow;
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
  rendererWindow.removeMenu();
  void rendererWindow.loadURL(`file://${__dirname}/html/index.html?renderer`);

  if (!app.isPackaged) {
    rendererWindow.webContents.openDevTools();
  }
};
const sendMessageToRenderer = (value) => {
  rendererWindow.webContents.send("response", { ...value, target: "renderer" });
};

export { createRendererWindow, sendMessageToRenderer };
