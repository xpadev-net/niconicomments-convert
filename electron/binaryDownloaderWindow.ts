import { app, BrowserWindow } from "electron";
import * as path from "path";
import { baseUrl } from "./context";
import { apiResponsesToBinaryDownloader } from "@/@types/response.binaryDownloader";

let binaryDownloaderWindow: BrowserWindow;
const createBinaryDownloaderWindow = async () => {
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

  if (!app.isPackaged) {
    binaryDownloaderWindow.webContents.openDevTools();
  }
};
const sendMessageToBinaryDownloader = (
  value: apiResponsesToBinaryDownloader
) => {
  binaryDownloaderWindow.webContents.send("response", {
    ...value,
    target: "downloader",
  });
};

export {
  createBinaryDownloaderWindow,
  sendMessageToBinaryDownloader,
  binaryDownloaderWindow,
};
