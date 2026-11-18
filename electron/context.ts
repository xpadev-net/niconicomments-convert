import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { app } from "electron";

const baseUrl = app.isPackaged
  ? pathToFileURL(path.join(import.meta.dirname, "html", "index.html")).href
  : "http://localhost:5173";

const binPath = path.join(app.getPath("userData"), "bin");

const appPrefix = "niconicomments-convert";

export { appPrefix, baseUrl, binPath };
