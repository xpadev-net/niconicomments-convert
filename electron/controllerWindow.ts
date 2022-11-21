import { app, BrowserWindow } from "electron";
import * as path from "path";

let controllerWindow: BrowserWindow;
const createControllerWindow = () => {
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

  const appURL = `file://${__dirname}/html/index.html`;

  void controllerWindow.loadURL(appURL);

  if (!app.isPackaged) {
    controllerWindow.webContents.openDevTools();
  }
};
const sendMessageToController = (value) => {
  controllerWindow.webContents.send("response", {
    ...value,
    target: "controller",
  });
};

export { createControllerWindow, sendMessageToController };
