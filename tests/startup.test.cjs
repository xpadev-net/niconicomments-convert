const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { loadCompiled } = require("./helpers/load-typescript.cjs");
const load = (filename, imports, globals) =>
  loadCompiled(path.join("build/electron", filename), imports, globals);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const fixture = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "startup-"));
  t.after(() => fs.rmSync(dir, { force: true, recursive: true }));
  return dir;
};

for (const isPackaged of [true, false]) {
  test(`binary storage uses userData (packaged=${isPackaged})`, () => {
    const context = load("context.js", {
      electron: {
        app: {
          isPackaged,
          getPath: (name) => {
            assert.equal(name, "userData");
            return "/writable/app-data";
          },
        },
      },
    });
    assert.equal(context.binPath, path.join("/writable/app-data", "bin"));
  });
}

test("logging creates the Electron logs path recursively", (t) => {
  const logDir = path.join(fixture(t), "nested", "logs");
  const logger = { initialize() {}, transports: { file: {} } };
  const events = [];
  const { initLogger } = load(
    "lib/log.js",
    {
      electron: {
        app: {
          getPath: (name) => {
            assert.equal(name, "logs");
            return logDir;
          },
        },
      },
      "electron-log/main.js": logger,
    },
    { process: { on: (...args) => events.push(args) } },
  );
  initLogger();
  assert.ok(fs.statSync(logDir).isDirectory());
  assert.equal(path.dirname(logger.transports.file.resolvePathFn()), logDir);
  assert.equal(logger.transports.file.level, "info");
  assert.equal(events[0][0], "uncaughtException");
});

test("an unavailable log path preserves startup diagnostics via console logging", () => {
  const warnings = [];
  const logger = {
    initialize() {},
    transports: { file: {} },
    warn: (...args) => warnings.push(args),
  };
  load(
    "lib/log.js",
    {
      electron: {
        app: {
          getPath: () => {
            throw new Error("EACCES");
          },
        },
      },
      "electron-log/main.js": logger,
    },
    { process: { on() {} } },
  ).initLogger();
  assert.equal(logger.transports.file.level, false);
  assert.equal(warnings.length, 1);
});

const assetHarness = (t, options = {}) => {
  const binPath = options.binPath ?? path.join(fixture(t), "data", "bin");
  const downloads = [],
    progress = [],
    windows = [];
  const permissions = [];
  const signal = new AbortController();
  const api = load(
    "assets.js",
    {
      "./context": { binPath },
      "node:fs": {
        ...fs,
        promises: {
          ...fs.promises,
          chmod: async (filename, mode) => {
            permissions.push({ filename, mode });
            await fs.promises.chmod(filename, mode);
          },
        },
      },
      "./binary-downloader-window": {
        createBinaryDownloaderWindow: async () => {
          windows.push("open");
          if (options.windowError) throw new Error("loadURL failed");
        },
        closeBinaryDownloaderWindow: () => windows.push("close"),
        sendMessageToBinaryDownloader: (message) => progress.push(message),
      },
      "./lib/spawn": {
        spawn: (filename, args, init) => {
          assert.deepEqual(args, ["-version"]);
          assert.equal(init.signal, signal.signal);
          assert.ok(init.timeout > 0);
          return {
            promise: Promise.resolve({
              stdout: fs.readFileSync(filename, "utf8"),
            }),
          };
        },
      },
      "node:os": { arch: () => options.arch ?? "x64" },
      ...(options.imports ?? {}),
      undici: {},
    },
    {
      process: { platform: options.platform ?? "darwin", env: {} },
      fetch: async (url, init) => {
        assert.equal(init.signal, signal.signal);
        downloads.push(url);
        return options.fetch
          ? options.fetch(url, init)
          : new Response("ffmpeg version 6.1");
      },
      console: { warn() {} },
    },
  );
  return {
    ...api,
    binPath,
    signal,
    downloads,
    permissions,
    progress,
    windows,
    run: () => api.onStartUp(signal.signal),
  };
};
const cache = (harness, name, content = "ffmpeg version 6.1") => {
  fs.mkdirSync(harness.binPath, { recursive: true });
  fs.writeFileSync(harness[`${name}Path`], content);
};

test("valid cached binaries skip downloads and the preparation window", async (t) => {
  const harness = assetHarness(t);
  cache(harness, "ffmpeg");
  cache(harness, "ffprobe");
  await harness.run();
  assert.deepEqual(harness.downloads, []);
  assert.deepEqual(harness.windows, []);
});

for (const platform of ["darwin", "win32"]) {
  test(`${platform}: downloaded binaries are validated and published without partial files`, async (t) => {
    const harness = assetHarness(t, { platform });
    await harness.run();
    assert.equal(harness.downloads.length, 2);
    assert.deepEqual(harness.windows, ["open", "close"]);
    for (const name of ["ffmpeg", "ffprobe"]) {
      assert.equal(
        fs.readFileSync(harness[`${name}Path`], "utf8"),
        "ffmpeg version 6.1",
      );
      // Windows does not expose POSIX execute bits, even for a simulated Mac download.
      if (platform === "darwin" && process.platform !== "win32")
        assert.equal(fs.statSync(harness[`${name}Path`]).mode & 0o777, 0o755);
      assert.equal(
        harness.progress.filter((message) => message.name === name).at(-1)
          .progress,
        1,
      );
    }
    assert.deepEqual(
      harness.permissions.map(({ mode }) => mode),
      platform === "darwin" ? [0o755, 0o755] : [],
    );
    assert.ok(
      fs.readdirSync(harness.binPath).every((name) => !name.includes(".part")),
    );
  });
}

for (const [platform, arch, accepted] of [
  ["darwin", "x64", true],
  ["darwin", "arm64", false],
  ["win32", "x64", false],
]) {
  test(`${platform}/${arch}: pinned-release 7.1 binaries match only their known distribution`, async (t) => {
    const h = assetHarness(t, {
      platform,
      arch,
      fetch: async () => new Response("ffmpeg version 7.1"),
    });
    if (accepted) {
      await h.run();
      assert.equal(h.downloads.length, 2);
      assert.equal(fs.readFileSync(h.ffmpegPath, "utf8"), "ffmpeg version 7.1");
    } else {
      await assert.rejects(h.run(), /failed version validation/);
      assert.equal(fs.existsSync(h.ffmpegPath), false);
    }
  });
}

test("the macOS x64 cache accepts the actual pinned 7.1 release", async (t) => {
  const h = assetHarness(t, { platform: "darwin", arch: "x64" });
  cache(h, "ffmpeg", "ffmpeg version 7.1");
  cache(h, "ffprobe", "ffprobe version 7.1");
  await h.run();
  assert.deepEqual(h.downloads, []);
  assert.deepEqual(h.windows, []);
});

test("retry checks the cache again and downloads only the missing binary", async (t) => {
  let fail = true;
  const harness = assetHarness(t, {
    fetch: async (url) => {
      if (url.split("/").at(-1).startsWith("ffprobe") && fail) {
        throw new Error("offline");
      }
      return new Response("ffmpeg version 6.1");
    },
  });
  await assert.rejects(harness.run(), /offline/);
  assert.equal(fs.existsSync(harness.ffmpegPath), true);
  assert.equal(fs.existsSync(harness.ffprobePath), false);
  fail = false;
  await harness.run();
  assert.equal(harness.downloads.length, 3);
  assert.ok(harness.downloads[2].split("/").at(-1).startsWith("ffprobe"));
  assert.deepEqual(harness.windows, ["open", "close", "open", "close"]);
});

for (const platform of ["darwin", "win32"]) {
  for (const otherFails of [false, true]) {
    test(`${platform}: another download's ${otherFails ? "failure cleanup" : "publication"} preserves an in-progress download`, async (t) => {
      const validating = deferred();
      const resume = deferred();
      t.after(() => resume.resolve());
      const content = "ffmpeg version 6.1 first download";
      let firstTemporaryPath;
      const first = assetHarness(t, {
        platform,
        fetch: async () => new Response(content),
        imports: {
          "./lib/spawn": {
            spawn: (filename) => ({
              promise: (async () => {
                if (filename.includes(".part")) {
                  firstTemporaryPath = filename;
                  validating.resolve();
                  await resume.promise;
                }
                return { stdout: fs.readFileSync(filename, "utf8") };
              })(),
            }),
          },
        },
      });
      cache(first, "ffprobe");
      const firstResult = first.run().then(
        () => undefined,
        (error) => error,
      );
      await validating.promise;
      try {
        const other = assetHarness(t, {
          platform,
          binPath: first.binPath,
          fetch: async () =>
            new Response(
              otherFails
                ? "invalid binary"
                : "ffmpeg version 6.1 other download",
            ),
        });
        if (otherFails) {
          await assert.rejects(other.run(), /version validation/);
        } else {
          await other.run();
          assert.equal(
            fs.readFileSync(other.ffmpegPath, "utf8"),
            "ffmpeg version 6.1 other download",
          );
        }
        assert.equal(fs.readFileSync(firstTemporaryPath, "utf8"), content);
      } finally {
        resume.resolve();
        assert.equal(await firstResult, undefined);
      }
      assert.equal(fs.readFileSync(first.ffmpegPath, "utf8"), content);
      assert.deepEqual(
        fs.readdirSync(first.binPath).sort(),
        platform === "win32"
          ? ["ffmpeg.exe", "ffprobe.exe"]
          : ["ffmpeg", "ffprobe"],
      );
    });
  }
}

for (const failure of ["http", "stream", "invalid", "write"]) {
  test(`${failure} failure closes preparation and preserves the existing binary`, async (t) => {
    const harness = assetHarness(t, {
      fetch: async () => {
        if (failure === "http")
          return new Response("unavailable", { status: 503 });
        if (failure === "stream")
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("connection lost"));
              },
            }),
          );
        return new Response("wrong binary");
      },
      imports:
        failure === "write"
          ? {
              "node:fs": {
                ...fs,
                createWriteStream: (filename) =>
                  fs.createWriteStream(path.join(filename, "missing")),
              },
            }
          : {},
    });
    cache(harness, "ffmpeg", "old invalid binary");
    await assert.rejects(harness.run());
    assert.equal(
      fs.readFileSync(harness.ffmpegPath, "utf8"),
      "old invalid binary",
    );
    assert.deepEqual(fs.readdirSync(harness.binPath), ["ffmpeg"]);
    assert.deepEqual(harness.windows, ["open", "close"]);
  });
}

test("directory creation failure closes preparation before propagating the error", async (t) => {
  const harness = assetHarness(t, {
    imports: {
      "node:fs": {
        ...fs,
        promises: {
          ...fs.promises,
          mkdir: async () => {
            throw new Error("EACCES");
          },
        },
      },
    },
  });
  await assert.rejects(harness.run(), /EACCES/);
  assert.deepEqual(harness.windows, ["open", "close"]);
  assert.equal(harness.downloads.length, 0);
});

test("a failed preparation page is closed before retry", async (t) => {
  const harness = assetHarness(t, { windowError: true });
  await assert.rejects(harness.run(), /loadURL failed/);
  assert.deepEqual(harness.windows, ["open", "close"]);
  assert.equal(harness.downloads.length, 0);
});

test("quitting during a streaming download aborts it and removes the partial file", async (t) => {
  const started = deferred();
  const harness = assetHarness(t, {
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            started.resolve();
          },
        }),
      ),
  });
  const task = harness.run();
  const rejected = assert.rejects(task, { name: "AbortError" });
  await started.promise;
  await tick();
  harness.signal.abort();
  await rejected;
  assert.deepEqual(fs.readdirSync(harness.binPath), []);
  assert.deepEqual(harness.windows, ["open", "close"]);
});

test("unsupported platforms fail during preparation rather than module loading", async (t) => {
  const harness = assetHarness(t, { platform: "linux" });
  await assert.rejects(harness.run(), /unknown os or architecture/);
  assert.deepEqual(harness.windows, ["open", "close"]);
});

const startupHarness = (
  prepare,
  showDialog = async () => ({ response: 1 }),
) => {
  const app = new EventEmitter();
  const dialogs = [],
    errors = [];
  let controllers = 0,
    quits = 0;
  app.whenReady = async () => {};
  app.quit = () => {
    quits++;
    app.emit("before-quit");
    app.emit("will-quit");
  };
  const { startApplication } = load("startup.js", {
    electron: {
      app,
      BrowserWindow: { getAllWindows: () => [] },
      dialog: {
        showMessageBox: (options) => {
          dialogs.push(options);
          return showDialog(options);
        },
      },
    },
    "./assets": { onStartUp: prepare },
    "./updater.js": { initUpdateCheck: async () => {} },
    "./controller-window": {
      createControllerWindow: () => {
        controllers++;
      },
    },
    "./lib/log": {
      getLogger: () => ({ error: (...args) => errors.push(args) }),
    },
  });
  return {
    app,
    dialogs,
    errors,
    startApplication,
    get controllers() {
      return controllers;
    },
    get quits() {
      return quits;
    },
  };
};

test("activation and closing the preparation window cannot open the controller or quit early", async () => {
  const pending = deferred();
  const harness = startupHarness(() => pending.promise);
  const task = harness.startApplication();
  await tick();
  harness.app.emit("activate");
  harness.app.emit("window-all-closed");
  assert.equal(harness.controllers, 0);
  assert.equal(harness.quits, 0);
  pending.resolve();
  await task;
  assert.equal(harness.controllers, 1);
  assert.equal(harness.quits, 0);
  harness.app.emit("window-all-closed");
  assert.equal(harness.quits, 1);
  harness.app.emit("activate");
  assert.equal(harness.controllers, 1);
});

test("startup failure offers retry and opens the controller only after success", async () => {
  const response = deferred();
  let attempts = 0;
  const harness = startupHarness(
    async () => {
      if (++attempts === 1) throw new Error("offline");
    },
    () => response.promise,
  );
  const task = harness.startApplication();
  await tick();
  assert.match(harness.dialogs[0].detail, /offline/);
  assert.deepEqual(harness.dialogs[0].buttons, ["再試行", "終了"]);
  assert.equal(harness.dialogs[0].cancelId, 1);
  harness.app.emit("activate");
  harness.app.emit("window-all-closed");
  assert.equal(harness.controllers, 0);
  assert.equal(harness.quits, 0);
  response.resolve({ response: 0 });
  await task;
  assert.equal(attempts, 2);
  assert.equal(harness.controllers, 1);
  assert.equal(harness.quits, 0);
});

test("choosing exit after preparation failure quits without opening the controller", async () => {
  const harness = startupHarness(async () => {
    throw new Error("EACCES");
  });
  await harness.startApplication();
  assert.equal(harness.quits, 1);
  assert.equal(harness.controllers, 0);
});

test("a canceled quit during conversion preserves ready behavior", async () => {
  const harness = startupHarness(async () => {});
  await harness.startApplication();
  // Electron emits before-quit, but not will-quit if a window prevents close.
  harness.app.emit("before-quit");
  assert.equal(harness.quits, 0);
  harness.app.emit("activate");
  assert.equal(harness.controllers, 2);
  // Once conversion finishes, closing the last controller must still quit.
  harness.app.emit("window-all-closed");
  assert.equal(harness.quits, 1);
  harness.app.emit("activate");
  assert.equal(harness.controllers, 2);
});

for (const rejects of [true, false]) {
  test(`quit during preparation prevents a late ${rejects ? "failure" : "success"} from opening any UI`, async () => {
    const pending = deferred();
    let signal;
    const harness = startupHarness((value) => {
      signal = value;
      return pending.promise;
    });
    const task = harness.startApplication();
    await tick();
    harness.app.quit();
    assert.equal(signal.aborted, true);
    if (rejects) pending.reject(new Error("aborted"));
    else pending.resolve();
    await task;
    assert.equal(harness.controllers, 0);
    assert.equal(harness.dialogs.length, 0);
  });
}

test("quit while the retry dialog is open suppresses a late retry response", async () => {
  const response = deferred();
  let attempts = 0;
  const harness = startupHarness(
    async () => {
      attempts++;
      throw new Error("offline");
    },
    () => response.promise,
  );
  const task = harness.startApplication();
  await tick();
  harness.app.quit();
  assert.equal(harness.dialogs[0].signal.aborted, true);
  response.resolve({ response: 0 });
  await task;
  assert.equal(attempts, 1);
  assert.equal(harness.controllers, 0);
});

test("failure to show the retry dialog still exits cleanly", async () => {
  const harness = startupHarness(
    async () => {
      throw new Error("offline");
    },
    async () => {
      throw new Error("dialog failed");
    },
  );
  await harness.startApplication();
  assert.equal(harness.quits, 1);
  assert.equal(harness.controllers, 0);
});

test("preparation window closure distinguishes cleanup from user cancellation", async () => {
  const windows = [];
  let quits = 0;
  class BrowserWindow extends EventEmitter {
    constructor() {
      super();
      this.destroyed = false;
      windows.push(this);
      this.webContents = { send() {} };
    }
    removeMenu() {}
    async loadURL() {}
    isDestroyed() {
      return this.destroyed;
    }
    close() {
      this.destroyed = true;
      this.emit("closed");
    }
  }
  const api = load("binary-downloader-window.js", {
    electron: {
      app: {
        isPackaged: true,
        quit: () => {
          quits++;
        },
      },
      BrowserWindow,
    },
    "./context": { baseUrl: "file:///app/index.html" },
  });
  await api.createBinaryDownloaderWindow();
  api.closeBinaryDownloaderWindow();
  assert.equal(quits, 0);
  await api.createBinaryDownloaderWindow();
  windows.at(-1).close();
  assert.equal(quits, 1);
  api.sendMessageToBinaryDownloader({
    type: "downloadProgress",
    name: "ffmpeg",
    progress: 1,
  });
  api.closeBinaryDownloaderWindow();
  assert.equal(quits, 1);
});
