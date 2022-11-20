import { app, BrowserWindow, globalShortcut, Menu } from "electron";
import { createControllerWindow } from "./controllerWindow";
import { registerListener } from "./ipcManager";

app.on("window-all-closed", () => {
  app.quit();
});
app.whenReady().then(() => {
  createControllerWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createControllerWindow();
  });
});
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
registerListener();
