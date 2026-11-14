const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const windowHarness = () => {
  const windows = [];
  class BrowserWindow extends EventEmitter {
    constructor() {
      super();
      this.webContents = new EventEmitter();
      this.webContents.send = () => {};
      this.loading = deferred();
      this.destroyed = false;
      windows.push(this);
    }
    removeMenu() {}
    loadURL() {
      return this.loading.promise;
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
  }
  const api = load("electron/renderer-window.ts", {
    electron: { app: { isPackaged: true }, BrowserWindow },
    "./context": { baseUrl: "http://localhost" },
    "./queue": { processingQueue: { status: "processing" } },
    "./store": { store: { get: () => false } },
  });
  return { ...api, windows };
};

for (const reason of ["crashed", "oom", "killed"]) {
  test(`renderer process ${reason} is a session failure`, () => {
    const harness = windowHarness();
    const failures = [];
    harness.createRendererWindow((error) => failures.push(error));
    harness.windows[0].webContents.emit(
      "render-process-gone",
      {},
      { reason, exitCode: 1 },
    );
    assert.equal(failures.length, 1);
    assert.ok(failures[0].message.includes(reason));
    harness.closeRendererWindow();
  });
}

for (const event of ["closed", "unresponsive"]) {
  test(`unexpected renderer ${event} is a session failure`, () => {
    const harness = windowHarness();
    const failures = [];
    harness.createRendererWindow((error) => failures.push(error));
    harness.windows[0].emit(event);
    assert.equal(failures.length, 1);
    harness.closeRendererWindow();
  });
}

test("renderer URL load failure is a session failure", async () => {
  const harness = windowHarness();
  const failures = [];
  harness.createRendererWindow((error) => failures.push(error));
  harness.windows[0].loading.reject(new Error("load failed"));
  await tick();
  assert.equal(failures[0].message, "load failed");
  harness.closeRendererWindow();
});

test("intentional teardown and late lifecycle events cannot fail the next renderer", async () => {
  const harness = windowHarness();
  const failures = [];
  harness.createRendererWindow((error) => failures.push(error));
  const oldWindow = harness.windows[0];
  assert.equal(harness.isRendererSender(oldWindow.webContents), true);
  harness.closeRendererWindow();
  assert.equal(oldWindow.destroyed, true);
  harness.createRendererWindow((error) => failures.push(error));
  oldWindow.loading.reject(new Error("late load failure"));
  oldWindow.webContents.emit(
    "render-process-gone",
    {},
    { reason: "crashed", exitCode: 1 },
  );
  await tick();
  assert.equal(failures.length, 0);
  assert.equal(harness.isRendererSender(oldWindow.webContents), false);
  assert.equal(harness.isRendererSender(harness.windows[1].webContents), true);
  harness.closeRendererWindow();
});

const ipcHarness = () => {
  const failures = [],
    frames = [],
    ends = [];
  let handler;
  let sender = {};
  let onLoad = async () => {};
  const { typeGuard } = load("electron/type-guard.ts", {});
  const { registerListener } = load("electron/ipc-manager.ts", {
    electron: {
      ipcMain: {
        handle(_name, callback) {
          handler = callback;
        },
      },
    },
    "./controller-window": {},
    "./dialog": {},
    "./lib/cookie": {},
    "./lib/json": {},
    "./lib/log": { getLogger: () => ({ debug() {} }) },
    "./lib/niconico": {},
    "./store": {},
    "./type-guard": { typeGuard },
    "./queue": {
      failConversion: (error) => failures.push(error),
      appendFrame: (...args) => frames.push(args),
      markAsCompleted: (...args) => ends.push(args),
      processOnLoad: () => onLoad(),
    },
    "./renderer-window": { isRendererSender: (value) => value === sender },
  });
  registerListener();
  return {
    failures,
    frames,
    ends,
    get sender() {
      return sender;
    },
    set sender(value) {
      sender = value;
    },
    set onLoad(value) {
      onLoad = value;
    },
    request: (from, request) =>
      handler({ sender: from }, { data: [{ host: "renderer", ...request }] }),
  };
};

test("renderer failure IPC terminates only its current session", async () => {
  const harness = ipcHarness();
  const oldSender = harness.sender;
  await harness.request(oldSender, {
    type: "failure",
    message: "drawing failed",
  });
  assert.equal(harness.failures[0].message, "drawing failed");
  harness.sender = {};
  await harness.request(oldSender, {
    type: "failure",
    message: "late failure",
  });
  await harness.request(oldSender, {
    type: "blob",
    frameId: 1,
    data: new Uint8Array([1]),
  });
  await harness.request(oldSender, { type: "end", frameId: 1 });
  assert.equal(harness.failures.length, 1);
  assert.equal(harness.frames.length, 0);
  assert.equal(harness.ends.length, 0);
});

test("renderer load IPC errors terminate the session and reject the request", async () => {
  const harness = ipcHarness();
  harness.onLoad = async () => {
    throw new Error("comments unreadable");
  };
  await assert.rejects(
    harness.request(harness.sender, { type: "load" }),
    /comments unreadable/,
  );
  assert.equal(harness.failures.length, 1);
});

test("a late load IPC rejection cannot fail the next session", async () => {
  const harness = ipcHarness();
  const pending = deferred();
  harness.onLoad = () => pending.promise;
  const request = harness.request(harness.sender, { type: "load" });
  harness.sender = {};
  pending.reject(new Error("old load failed"));
  await assert.rejects(request, /old load failed/);
  assert.equal(harness.failures.length, 0);
});
