import { app, dialog, net, shell } from "electron";

import { isNewerVersion } from "../src/domain/update";
import { getLogger } from "./lib/log";
import { store } from "./store";

const logger = getLogger("[updater]");
const LATEST_RELEASE_API =
  "https://api.github.com/repos/xpadev-net/niconicomments-convert/releases/latest";

// macOS: electron-updater downloads and installs on quit (requires a signed
// build and the zip target + latest-mac.yml published with each release).
const autoUpdate = async (): Promise<void> => {
  const { autoUpdater } = await import("electron-updater");
  autoUpdater.logger = logger;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  await autoUpdater.checkForUpdates();
};

// Windows (portable zip): electron-updater cannot update it, so only notify.
const notifyUpdate = async (): Promise<void> => {
  const response = await net.fetch(LATEST_RELEASE_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const release = (await response.json()) as {
    tag_name?: unknown;
    html_url?: unknown;
  };
  const { tag_name: tag, html_url: url } = release;
  if (typeof tag !== "string" || typeof url !== "string") return;
  if (!isNewerVersion(tag, app.getVersion())) return;
  if (!url.startsWith("https://github.com/")) return;
  const { response: choice } = await dialog.showMessageBox({
    type: "info",
    title: "更新があります",
    message: `新しいバージョン ${tag} が公開されています。`,
    detail: `現在のバージョン: ${app.getVersion()}\nダウンロードページを開きますか？`,
    buttons: ["ダウンロードページを開く", "あとで"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (choice === 0) await shell.openExternal(url);
};

const checkForUpdates = async (): Promise<void> => {
  // Development builds report Electron's version, not the app's.
  if (!app.isPackaged) return;
  try {
    if (process.platform === "darwin") await autoUpdate();
    else await notifyUpdate();
  } catch (error) {
    logger.error("failed to check for updates:", error);
  }
};

const askOptIn = async (): Promise<void> => {
  const { response } = await dialog.showMessageBox({
    type: "question",
    title: "更新確認の設定",
    message: "起動時に更新を確認しますか？",
    detail:
      "新しいバージョンがある場合にお知らせします（macOSでは自動でダウンロードし、終了時にインストールします）。\nこの設定は「設定」画面からいつでも変更できます。",
    buttons: ["確認する", "確認しない"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  store.set("updateCheck", response === 0 ? "enabled" : "disabled");
};

// Called once after the controller window is shown.
const initUpdateCheck = async (): Promise<void> => {
  if (!app.isPackaged) return;
  try {
    if (store.get("updateCheck") === "unset") await askOptIn();
    if (store.get("updateCheck") === "enabled") await checkForUpdates();
  } catch (error) {
    logger.error("failed to initialize update check:", error);
  }
};

// Called when the setting changes; checks immediately when turned on.
const onUpdateCheckSettingChanged = (): void => {
  if (store.get("updateCheck") === "enabled") void checkForUpdates();
};

export { initUpdateCheck, onUpdateCheckSettingChanged };
