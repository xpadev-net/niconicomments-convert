import * as path from "node:path";
import { app } from "electron";

const baseUrl = app.isPackaged
  ? `file://${__dirname}/html/index.html`
  : "http://localhost:5173";

const basePath = path.join(__dirname, app.isPackaged ? "../../../" : "");

const appPrefix = "niconicomments-convert";

export { appPrefix, basePath, baseUrl };
