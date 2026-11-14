import * as path from "node:path";
import { app } from "electron";

const baseUrl = app.isPackaged
  ? `file://${__dirname}/html/index.html`
  : "http://localhost:5173";

const binPath = path.join(app.getPath("userData"), "bin");

const appPrefix = "niconicomments-convert";

export { appPrefix, baseUrl, binPath };
