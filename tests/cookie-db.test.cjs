const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const sqlite3 = require("sqlite3");

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "cookie-db-test-"));
const prefix = path.basename(fixtureDir);
const cloneDirs = () =>
  fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith(`${prefix}-`));

after(() => {
  for (const name of cloneDirs()) {
    fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
  }
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

const { loadCompiled } = require("./helpers/load-typescript.cjs");
const { fetchAll, withClonedDB } = loadCompiled("build/electron/lib/db.js", {
  "../context": { appPrefix: prefix },
});

const createDB = async (profile, value = "session") => {
  const directory = path.join(fixtureDir, profile);
  fs.mkdirSync(directory);
  const filename = path.join(directory, "cookies.sqlite");
  const db = await new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filename, (error) => {
      if (error) reject(error);
      else resolve(database);
    });
  });
  try {
    await new Promise((resolve, reject) => {
      db.run("CREATE TABLE cookies (value TEXT)", (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await new Promise((resolve, reject) => {
      db.run("INSERT INTO cookies VALUES (?)", [value], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } finally {
    await new Promise((resolve, reject) => {
      db.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  return filename;
};

test("closes the clone and deletes its private directory before returning", async () => {
  const source = await createDB("success");
  let database;
  const rows = await withClonedDB(source, async (db) => {
    database = db;
    assert.equal(db.open, true);
    assert.notEqual(db.filename, source);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(path.dirname(db.filename)).mode & 0o077, 0);
    }
    await assert.rejects(
      fetchAll(db, "DELETE FROM cookies"),
      /SQLITE_READONLY/,
    );
    return await fetchAll(db, "SELECT value FROM cookies");
  });
  assert.deepEqual(rows, [{ value: "session" }]);
  assert.equal(database.open, false);
  assert.equal(fs.existsSync(path.dirname(database.filename)), false);
  assert.equal(fs.existsSync(source), true);
  assert.deepEqual(cloneDirs(), []);
});

test("isolates concurrent profiles with the same database basename", async () => {
  const sources = await Promise.all([
    createDB("profile-a", "a"),
    createDB("profile-b", "b"),
  ]);
  const ready = Promise.withResolvers();
  const databases = [];
  const rows = await Promise.all(
    sources.map((source) =>
      withClonedDB(source, async (db) => {
        databases.push(db);
        if (databases.length === sources.length) ready.resolve();
        await ready.promise;
        return await fetchAll(db, "SELECT value FROM cookies");
      }),
    ),
  );
  assert.deepEqual(rows, [[{ value: "a" }], [{ value: "b" }]]);
  assert.notEqual(databases[0].filename, databases[1].filename);
  assert.ok(databases.every((db) => !db.open));
  assert.deepEqual(cloneDirs(), []);
});

test("cleans up when a query rejects", async () => {
  const source = await createDB("query-error");
  let database;
  await assert.rejects(
    withClonedDB(source, async (db) => {
      database = db;
      return await fetchAll(db, "SELECT * FROM missing_table");
    }),
    /SQLITE_ERROR/,
  );
  assert.equal(database.open, false);
  assert.deepEqual(cloneDirs(), []);
});

test("cleans up when the callback throws synchronously", async () => {
  const source = await createDB("callback-error");
  const error = new Error("callback failed");
  let database;
  await assert.rejects(
    withClonedDB(source, (db) => {
      database = db;
      throw error;
    }),
    error,
  );
  assert.equal(database.open, false);
  assert.deepEqual(cloneDirs(), []);
});

test("removes the temporary directory when copying fails", async () => {
  await assert.rejects(
    withClonedDB(path.join(fixtureDir, "missing"), async () => {
      assert.fail("must not invoke the callback");
    }),
    { code: "ENOENT" },
  );
  assert.deepEqual(cloneDirs(), []);
});

test("removes the temporary directory when opening fails", async (t) => {
  const source = await createDB("open-error");
  const copy = t.mock.method(fs, "copyFileSync", (_source, destination) => {
    fs.mkdirSync(destination);
  });
  t.after(() => {
    copy.mock.restore();
  });
  await assert.rejects(
    withClonedDB(source, async () => {
      assert.fail("must not invoke the callback");
    }),
    /SQLITE_(?:CANTOPEN|IOERR)/,
  );
  assert.deepEqual(cloneDirs(), []);
});

test("attempts directory removal even when close reports an error", async (t) => {
  const source = await createDB("close-error");
  const close = sqlite3.Database.prototype.close;
  const error = new Error("close failed");
  t.mock.method(sqlite3.Database.prototype, "close", function (callback) {
    return close.call(this, (closeError) => callback(closeError ?? error));
  });
  await assert.rejects(
    withClonedDB(source, async () => "done"),
    error,
  );
  assert.deepEqual(cloneDirs(), []);
});
