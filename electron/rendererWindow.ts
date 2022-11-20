import { app, BrowserWindow } from "electron";
import * as path from "path";

let rendererWindow;
const createRendererWindow = () => {
  rendererWindow = new BrowserWindow({
    width: 640,
    height: 360,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  rendererWindow.removeMenu();
  rendererWindow.loadURL(`file://${__dirname}/html/index.html?renderer`);

  if (!app.isPackaged) {
    rendererWindow.webContents.openDevTools();
  }
};
const sendMessageToRenderer = (value) => {
  rendererWindow.webContents.send("response", { ...value, target: "renderer" });
};

export { createRendererWindow, sendMessageToRenderer };
