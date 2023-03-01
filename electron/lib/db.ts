import * as sqlite3 from "sqlite3";

type sqliteParam =
  | {
      [key: string]: unknown;
    }
  | unknown[];

const fetchAll = (
  db: sqlite3.Database,
  sql: string,
  param?: sqliteParam
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

export { fetchAll };
