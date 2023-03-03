import { app, BrowserWindow, globalShortcut } from "electron";
import { createControllerWindow } from "./controllerWindow";
import { registerListener } from "./ipcManager";
import { onStartUp } from "./ffmpeg";
import {
  getAvailableChromiumProfiles,
  getChromiumCookies,
} from "./lib/cookies/chromium";

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
registerListener();

getChromiumCookies({
  type: "chromiumProfile",
  browser: "brave",
  name: "プロフィール 1",
  path: "/Users/xpa/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies",
});
