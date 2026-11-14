import { app, BrowserWindow, dialog } from "electron";

import { onStartUp } from "./assets";
import { createControllerWindow } from "./controller-window";
import { getLogger } from "./lib/log";

type StartupState = "preparing" | "ready" | "quitting";

// Register lifecycle handlers before waiting for Electron or downloading assets.
const startApplication = async (): Promise<void> => {
  let state: StartupState = "preparing";
  const preparation = new AbortController();
  const logger = getLogger("startup");
  app.on("before-quit", () => {
    // The controller can cancel quitting while a conversion is running.
    if (state === "ready") return;
    state = "quitting";
    preparation.abort();
  });
  app.on("will-quit", () => {
    state = "quitting";
  });
  app.on("window-all-closed", () => {
    // Closing the preparation window is also part of success and retry cleanup.
    if (state === "ready") app.quit();
  });
  app.on("activate", () => {
    if (state === "ready" && BrowserWindow.getAllWindows().length === 0) {
      createControllerWindow();
    }
  });

  try {
    await app.whenReady();
    while (!preparation.signal.aborted) {
      try {
        await onStartUp(preparation.signal);
        if (preparation.signal.aborted) return;
        createControllerWindow();
        state = "ready";
        return;
      } catch (error) {
        if (preparation.signal.aborted) return;
        logger.error("Startup preparation failed:", error);
        const { response } = await dialog.showMessageBox({
          type: "error",
          title: "起動準備に失敗しました",
          message: "必要なファイルを準備できませんでした。",
          detail: `${error instanceof Error ? error.message : String(error)}\n\nネットワーク接続や保存先の書き込み権限を確認して、再試行してください。`,
          buttons: ["再試行", "終了"],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
          signal: preparation.signal,
        });
        if (preparation.signal.aborted) return;
        if (response !== 0) {
          state = "quitting";
          app.quit();
          return;
        }
      }
    }
  } catch (error) {
    logger.error("Application startup failed:", error);
    state = "quitting";
    app.quit();
  }
};

export { startApplication };
