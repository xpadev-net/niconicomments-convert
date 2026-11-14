import { app, globalShortcut } from "electron";

import { registerListener } from "./ipc-manager";
import { initLogger } from "./lib/log";
import { startApplication } from "./startup";

if (app.isPackaged) {
  app.on("browser-window-focus", () => {
    globalShortcut.register("CommandOrControl+R", () => {
      console.log("CommandOrControl+R is pressed: Shortcut Disabled");
    });
    globalShortcut.register("F5", () => {
      console.log("F5 is pressed: Shortcut Disabled");
    });
  });

  app.on("browser-window-blur", () => {
    globalShortcut.unregister("CommandOrControl+R");
    globalShortcut.unregister("F5");
  });
}
initLogger();
registerListener();
void startApplication();
