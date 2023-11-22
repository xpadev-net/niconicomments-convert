import { app, BrowserWindow } from "electron";
import * as path from "path";

import type { ApiResponsesToBinaryDownloader } from "@/@types/response.binaryDownloader";

import { baseUrl } from "./context";

let binaryDownloaderWindow: BrowserWindow;
const createBinaryDownloaderWindow = async (): Promise<void> => {
  binaryDownloaderWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  binaryDownloaderWindow.removeMenu();

  const appURL = `${baseUrl}?binary-downloader`;

  await binaryDownloaderWindow.loadURL(appURL);
  binaryDownloaderWindow.on("close", (e) => {
    e.preventDefault();
  });

  if (!app.isPackaged) {
    binaryDownloaderWindow.webContents.openDevTools();
  }
};
const sendMessageToBinaryDownloader = (
  value: ApiResponsesToBinaryDownloader,
): void => {
  binaryDownloaderWindow.webContents.send("response", {
    ...value,
    target: "downloader",
  });
};

export {
  binaryDownloaderWindow,
  createBinaryDownloaderWindow,
  sendMessageToBinaryDownloader,
};
