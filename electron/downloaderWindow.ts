import { app, BrowserWindow } from "electron";
import * as path from "path";
import { baseUrl } from "./context";
import { apiResponsesToDownloader } from "@/@types/response.downloader";

let downloaderWindow: BrowserWindow;
const createDownloaderWindow = async () => {
  downloaderWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  downloaderWindow.removeMenu();

  const appURL = `${baseUrl}?downloader`;

  await downloaderWindow.loadURL(appURL);

  if (!app.isPackaged) {
    downloaderWindow.webContents.openDevTools();
  }
};
const sendMessageToDownloader = (value: apiResponsesToDownloader) => {
  downloaderWindow.webContents.send("response", {
    ...value,
    target: "downloader",
  });
};

export { createDownloaderWindow, sendMessageToDownloader, downloaderWindow };
