import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Database } from "sqlite3";
import * as sqlite3 from "sqlite3";

import { appPrefix } from "../context";

const openClonedDB = (filepath: string): Database => {
  const filename = path.basename(filepath);
  const tmpDir = path.join(os.tmpdir(), appPrefix);
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, filename);
  fs.mkdtempSync(tmpDir);
  fs.copyFileSync(filepath, tmpFile);
  return new sqlite3.Database(tmpFile, sqlite3.OPEN_READONLY);
};

type sqliteParam =
  | {
      [key: string]: unknown;
    }
  | unknown[];

const fetchAll = (
  db: sqlite3.Database,
  sql: string,
  param?: sqliteParam,
): Promise<unknown[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, param, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

export { fetchAll, openClonedDB };
