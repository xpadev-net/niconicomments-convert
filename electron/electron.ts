import { app, BrowserWindow, globalShortcut } from "electron";

import { onStartUp } from "./assets";
import { createControllerWindow } from "./controller-window";
import { registerListener } from "./ipc-manager";
import { initLogger } from "./lib/log";

app.on("window-all-closed", () => {
  app.quit();
});
app
  .whenReady()
  .then(async () => {
    await onStartUp();
    createControllerWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createControllerWindow();
    });
  })
  .catch((e) => console.warn(e));
if (app.isPackaged) {
  app.on("browser-window-focus", function () {
    globalShortcut.register("CommandOrControl+R", () => {
      console.log("CommandOrControl+R is pressed: Shortcut Disabled");
    });
    globalShortcut.register("F5", () => {
      console.log("F5 is pressed: Shortcut Disabled");
    });
  });

  app.on("browser-window-blur", function () {
    globalShortcut.unregister("CommandOrControl+R");
    globalShortcut.unregister("F5");
  });
}
initLogger();
registerListener();
