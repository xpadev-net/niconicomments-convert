import * as path from "node:path";
import { app, BrowserWindow } from "electron";

import type { ApiResponsesToBinaryDownloader } from "@/@types/response.binary-downloader.js";

import { baseUrl } from "./context.js";

let binaryDownloaderWindow: BrowserWindow | undefined;

const createBinaryDownloaderWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: ["--ipc-role=downloader"],
    },
  });
  binaryDownloaderWindow = window;
  window.removeMenu();
  window.on("closed", () => {
    if (binaryDownloaderWindow !== window) return;
    binaryDownloaderWindow = undefined;
    app.quit();
  });

  const appURL = `${baseUrl}?binary-downloader`;

  await window.loadURL(appURL);

  if (!app.isPackaged && !window.isDestroyed()) {
    window.webContents.openDevTools();
  }
};
const sendMessageToBinaryDownloader = (
  value: ApiResponsesToBinaryDownloader,
): void => {
  if (!binaryDownloaderWindow || binaryDownloaderWindow.isDestroyed()) return;
  binaryDownloaderWindow.webContents.send("response", {
    ...value,
    target: "downloader",
  });
};
const closeBinaryDownloaderWindow = (): void => {
  const window = binaryDownloaderWindow;
  binaryDownloaderWindow = undefined;
  if (window && !window.isDestroyed()) window.close();
};

export {
  closeBinaryDownloaderWindow,
  createBinaryDownloaderWindow,
  sendMessageToBinaryDownloader,
};
