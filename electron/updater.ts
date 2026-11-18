import { app, dialog } from "electron";

import { getLogger } from "./lib/log";
import { store } from "./store";

const logger = getLogger("[updater]");

let configured = false;

const getUpdater = async () => {
  const { autoUpdater } = await import("electron-updater");
  if (!configured) {
    configured = true;
    // Never download or install anything the user has not opted in to.
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = logger;
    autoUpdater.on("error", (error) => {
      logger.error("auto update failed:", error);
    });
  }
  return autoUpdater;
};

const checkForUpdates = async (): Promise<void> => {
  // Development builds have no app-update.yml.
  if (!app.isPackaged) return;
  try {
    const updater = await getUpdater();
    await updater.checkForUpdates();
  } catch (error) {
    logger.error("failed to check for updates:", error);
  }
};

const askOptIn = async (): Promise<void> => {
  const { response } = await dialog.showMessageBox({
    type: "question",
    title: "自動更新の設定",
    message: "起動時に更新を確認しますか？",
    detail:
      "新しいバージョンがある場合は、バックグラウンドでダウンロードし、アプリ終了時にインストールします。\nこの設定は「設定」画面からいつでも変更できます。",
    buttons: ["確認する", "確認しない"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  store.set("autoUpdate", response === 0 ? "enabled" : "disabled");
};

// Called once after the controller window is shown.
const initAutoUpdate = async (): Promise<void> => {
  if (!app.isPackaged) return;
  try {
    if (store.get("autoUpdate") === "unset") await askOptIn();
    if (store.get("autoUpdate") === "enabled") await checkForUpdates();
  } catch (error) {
    logger.error("failed to initialize auto update:", error);
  }
};

// Called when the setting changes; checks immediately when turned on.
const onAutoUpdateSettingChanged = (): void => {
  if (store.get("autoUpdate") === "enabled") void checkForUpdates();
};

export { initAutoUpdate, onAutoUpdateSettingChanged };
