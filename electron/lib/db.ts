import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Database } from "sqlite3";
import * as sqlite3 from "sqlite3";

import { appPrefix } from "../context";

const withClonedDB = async <T>(
  filepath: string,
  callback: (db: Database) => Promise<T>,
): Promise<T> => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${appPrefix}-`));
  let db: Database | undefined;
  try {
    const tmpFile = path.join(tmpDir, path.basename(filepath));
    fs.copyFileSync(filepath, tmpFile);
    db = await new Promise<Database>((resolve, reject) => {
      const database = new sqlite3.Database(
        tmpFile,
        sqlite3.OPEN_READONLY,
        (error) => {
          if (error) reject(error);
          else resolve(database);
        },
      );
    });
    return await callback(db);
  } finally {
    try {
      const database = db;
      if (database) {
        await new Promise<void>((resolve, reject) => {
          database.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
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

export { fetchAll, withClonedDB };
