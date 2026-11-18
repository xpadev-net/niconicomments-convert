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
const windowHarness = (options = {}) => {
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
      if (options.syncLoadError)
        throw new Error("loadURL failed synchronously");
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
    "../src/domain/validation": require("../build/src/domain/validation"),
    "./context": { baseUrl: "http://localhost" },
    "./queue": { processingQueue: { status: "processing" } },
    "./store": { store: { get: () => false } },
  });
  return {
    ...api,
    windows,
    closeRendererWindow: (window = windows.at(-1)) =>
      api.closeRendererWindow(window),
  };
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
  harness.closeRendererWindow();
});

const ipcHarness = () => {
  const failures = [],
    frames = [],
    ends = [];
  let handler;
  const createSender = (id) => ({
    id,
    mainFrame: { url: "http://localhost/?renderer" },
    isDestroyed: () => false,
  });
  let sender = createSender(1);
  let onLoad = async () => {};
  const schema = require("../build/electron/ipc-schema.js");
  const { registerListener } = load("electron/ipc-manager.ts", {
    electron: {
      ipcMain: {
        handle(_name, callback) {
          handler = callback;
        },
      },
    },
    "../src/domain/validation": require("../build/src/domain/validation"),
    "./context": { baseUrl: "http://localhost/" },
    "./controller-window": { isControllerSender: () => false },
    "./dialog": {},
    "./lib/cookie": {},
    "./lib/json": {},
    "./lib/log": { getLogger: () => ({ debug() {} }) },
    "./lib/niconico": {},
    "./updater": { onUpdateCheckSettingChanged: () => {} },
    "./store": {},
    "./ipc-schema": schema,
    "./queue": {
      failConversion: (rendererId, error) => {
        assert.equal(rendererId, sender.id);
        failures.push(error);
      },
      isRendererSender: (value) => value === sender,
      appendFrame: (...args) => frames.push(args),
      markAsCompleted: (...args) => ends.push(args),
      processOnLoad: () => onLoad(),
    },
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
      sender = { ...createSender(value.id), ...value };
    },
    set onLoad(value) {
      onLoad = value;
    },
    request: (from, request) =>
      handler(
        { sender: from, senderFrame: from.mainFrame },
        { host: "renderer", ...request },
      ),
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
  harness.sender = { id: 2 };
  for (const request of [
    { type: "failure", message: "late failure" },
    {
      type: "blob",
      sessionId: "old-session",
      frameId: 1,
      data: new Uint8Array([1]),
    },
    { type: "end", sessionId: "old-session", frameId: 1 },
  ])
    await assert.rejects(
      harness.request(oldSender, request),
      /Unauthorized IPC sender/,
    );
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
  harness.sender = { id: 2 };
  pending.reject(new Error("old load failed"));
  await assert.rejects(request, /old load failed/);
  assert.equal(harness.failures.length, 0);
});

test("synchronous renderer setup errors destroy the newly created window", () => {
  const harness = windowHarness({ syncLoadError: true });
  const failures = [];
  assert.throws(
    () => harness.createRendererWindow((error) => failures.push(error)),
    /loadURL failed synchronously/,
  );
  assert.equal(harness.windows[0].destroyed, true);
  assert.equal(failures.length, 0);
});
