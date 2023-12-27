import { app } from "electron";
import * as path from "path";

export const rootPath = path.join(
  __dirname,
  app.isPackaged ? "../../../../" : "",
);
