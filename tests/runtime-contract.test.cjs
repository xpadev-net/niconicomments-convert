const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");
const rendererHarness = require("./helpers/renderer.cjs");

const logger = { debug() {}, error() {} };
async function until(predicate) {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await delay(1);
  }
  assert.fail("runtime contract did not settle");
}

// Connect the production renderer, IPC dispatcher, queue and conversion session.
// Replace only Electron windows, Canvas, file I/O and the FFmpeg backend.
function harness(rendererOptions = {}) {
  const backends = [],
    windows = [],
    messages = [];
  let handler;
  const { ConversionSession } = load.loadCompiled(
    "build/electron/conversion-session.js",
    {
      "./converter": {
        createConverter() {
          const finished = Promise.withResolvers();
          const backend = { ...finished, chunks: [], stops: 0 };
          backend.inputStream = new Writable({
            write(chunk, _encoding, callback) {
              backend.chunks.push([...chunk]);
              callback();
            },
          });
          backends.push(backend);
          return {
            inputStream: backend.inputStream,
            run: () => finished.promise,
            stop: () => backend.stops++,
          };
        },
      },
    },
  );
  const controller = {
    isControllerSender: () => false,
    sendMessageToController: (message) =>
      messages.push(structuredClone(message)),
  };
  const queue = load("electron/queue.ts", {
    "../src/domain/conversion": require("../build/src/domain/conversion"),
    "../src/domain/validation": require("../build/src/domain/validation"),
    "../src/util/frame-timing": load("src/util/frame-timing.ts", {}),
    "node:fs": { readFileSync: () => "[]" },
    "@xpadev-net/xml2js": {},
    "./conversion-session": { ConversionSession },
    "./controller-window": controller,
    "./lib/json": { encodeError: String },
    "./lib/log": { getLogger: () => logger },
    "./lib/niconico": {},
    "./renderer-window": {
      createRendererWindow() {
        const sender = {
          id: windows.length + 1,
          mainFrame: { url: "http://localhost/?renderer" },
          isDestroyed: () => window.destroyed,
        };
        const renderer = rendererHarness({
          ...rendererOptions[sender.id],
          request: (request) =>
            handler({ sender, senderFrame: sender.mainFrame }, request),
        });
        const window = {
          webContents: sender,
          renderer,
          destroyed: false,
          isDestroyed() {
            return this.destroyed;
          },
          destroy() {
            this.destroyed = true;
            renderer.respond({ type: "end" });
          },
        };
        windows.push(window);
        return window;
      },
      closeRendererWindow: (window) => window.destroy(),
      sendMessageToRenderer: (window, message) =>
        window.renderer.respond(message),
    },
  });
  load("electron/ipc-manager.ts", {
    "../src/domain/validation": require("../build/src/domain/validation"),
    "./context": { baseUrl: "http://localhost/" },
    "./ipc-schema": require("../build/electron/ipc-schema"),
    electron: {
      ipcMain: {
        handle: (_name, callback) => {
          handler = callback;
        },
      },
    },
    "./controller-window": controller,
    "./dialog": {},
    "./lib/cookie": {},
    "./lib/json": { encodeError: String, encodeJson: JSON.stringify },
    "./lib/log": { getLogger: () => logger },
    "./lib/niconico": {},
    "./updater.js": { onUpdateCheckSettingChanged: () => {} },
    "./store": {},
    "./queue": queue,
  }).registerListener();
  return { queue, backends, windows, messages };
}

function job(id) {
  return {
    id,
    type: "convert",
    status: "queued",
    progress: {},
    movie: { type: "local", path: "movie.mp4", duration: 2 },
    comment: { type: "local", path: "comments.json", format: "formatted" },
    output: { path: `${id}.mp4` },
    option: { fps: 1, width: 640, height: 360, options: {} },
  };
}

async function finish(h, index) {
  const running = h.windows[index].renderer.run();
  await until(() => h.backends[index].inputStream.writableFinished);
  h.backends[index].resolve();
  await running;
  await until(() => h.windows[index].destroyed);
}

test("renderer end reaches the backend, and consecutive jobs wait for backend completion", {
  timeout: 5000,
}, async () => {
  const h = harness();
  const first = job("first"),
    second = job("second");
  h.queue.appendQueue(first);
  h.queue.appendQueue(second);
  const running = h.windows[0].renderer.run();
  await until(() => h.backends[0].inputStream.writableFinished);
  assert.equal(first.status, "processing");
  assert.equal(second.status, "queued");
  assert.equal(h.backends.length, 1);
  assert.equal(first.progress.processed, 2);
  h.backends[0].resolve();
  await running;
  await until(() => h.windows.length === 2);
  assert.equal(first.status, "completed");
  assert.equal(h.windows[0].destroyed, true);
  await finish(h, 1);
  assert.equal(second.status, "completed");
  assert.equal(h.queue.isConversionProcessing(), false);
  for (const window of h.windows) {
    const requests = window.renderer.requests;
    assert.deepEqual(
      requests.map(({ type }) => type),
      ["load", "blob", "blob", "end"],
    );
    assert.deepEqual(
      requests
        .filter(({ type }) => type === "blob")
        .map(({ frameId }) => frameId),
      [1, 2],
    );
    assert.equal(requests.at(-1).frameId, 2);
  }
  assert.notEqual(
    h.windows[0].renderer.requests.at(-1).sessionId,
    h.windows[1].renderer.requests.at(-1).sessionId,
  );
  assert.deepEqual(
    h.messages.at(-1).data.map(({ status }) => status),
    ["completed", "completed"],
  );
  assert.equal(
    h.messages.some(({ type }) => type === "message"),
    false,
  );
});

test("renderer failure propagates through IPC and the queue recovers after backend teardown", {
  timeout: 5000,
}, async () => {
  const h = harness({ 1: { drawErrorAt: 2 } });
  const first = job("failed"),
    second = job("next");
  h.queue.appendQueue(first);
  h.queue.appendQueue(second);
  await h.windows[0].renderer.run();
  assert.equal(h.backends[0].stops, 1);
  assert.equal(h.windows[0].destroyed, true);
  assert.equal(second.status, "queued");
  assert.equal(
    h.windows[0].renderer.requests.some(({ type }) => type === "end"),
    false,
  );
  h.backends[0].reject(new Error("backend shutdown"));
  await until(() => h.windows.length === 2);
  assert.equal(first.status, "fail");
  const errors = h.messages.filter(({ type }) => type === "message");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /draw failed/);
  await finish(h, 1);
  assert.equal(second.status, "completed");
});

test("interrupt stops an active renderer without success/failure IPC and allows the next job", {
  timeout: 5000,
}, async () => {
  const h = harness({
    1: { onDraw: () => h.queue.processOnInterrupt("interrupted") },
  });
  const first = job("interrupted"),
    second = job("next");
  h.queue.appendQueue(first);
  h.queue.appendQueue(second);
  await h.windows[0].renderer.run();
  assert.equal(h.backends[0].stops, 1);
  assert.equal(h.backends[0].inputStream.destroyed, true);
  assert.equal(second.status, "queued");
  assert.deepEqual(
    h.windows[0].renderer.requests.map(({ type }) => type),
    ["load"],
  );
  h.backends[0].reject(new Error("cancelled"));
  await until(() => h.windows.length === 2);
  assert.equal(first.status, "interrupted");
  await finish(h, 1);
  assert.equal(second.status, "completed");
  assert.equal(
    h.messages.some(({ type }) => type === "message"),
    false,
  );
});
