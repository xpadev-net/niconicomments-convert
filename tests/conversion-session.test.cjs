const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { EventEmitter } = require("node:events");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const Module = require("node:module");
const { tmpdir } = require("node:os");
const { dirname, join } = require("node:path");
const { Writable } = require("node:stream");
const { after, test } = require("node:test");

const build = mkdtempSync(join(tmpdir(), "conversion-session-test-"));
after(() => rmSync(build, { recursive: true, force: true }));
const tsc = join(
  dirname(require.resolve("typescript/package.json")),
  "bin/tsc",
);
execFileSync(process.execPath, [
  tsc,
  "-p",
  "electron",
  "--outDir",
  build,
  "--sourceMap",
  "false",
]);

function load(file, mocks) {
  const filename = join(build, "electron", file);
  const mod = new Module(filename, module);
  const originalRequire = Module.createRequire(filename);
  mod.require = (id) =>
    Object.hasOwn(mocks, id) ? mocks[id] : originalRequire(id);
  mod._compile(readFileSync(filename, "utf8"), filename);
  return mod.exports;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const logger = { debug() {}, log() {}, error() {} };

function queue(id) {
  return {
    id,
    type: "convert",
    status: "queued",
    progress: { processed: 0, total: 10, percent: 0 },
    comment: { type: "local", path: "comments.json", format: "formatted" },
    movie: { type: "local", path: "movie.mp4", duration: 10 },
    output: { path: `${id}.mp4` },
    option: { fps: 1, width: 640, height: 360, options: {} },
  };
}

function harness({
  stalled = false,
  writeError = false,
  delayedDestroy = false,
  windowError = false,
} = {}) {
  const backends = [];
  const { ConversionSession } = load("conversion-session.js", {
    "./converter": {
      createConverter() {
        const backend = { chunks: [], stops: 0 };
        backend.finished = new Promise((resolve, reject) => {
          backend.complete = resolve;
          backend.fail = reject;
        });
        backend.inputStream = new Writable({
          write(chunk, _, callback) {
            backend.chunks.push([...chunk]);
            if (writeError) callback(new Error("write failed"));
            else if (!stalled) callback();
          },
          destroy(error, callback) {
            if (delayedDestroy) backend.finishDestroy = () => callback(error);
            else callback(error);
          },
        });
        backend.run = () => backend.finished;
        backend.stop = () => backend.stops++;
        backends.push(backend);
        return backend;
      },
    },
  });
  let nextRendererId = 1;
  const renderers = [];
  const rendererFailures = [];
  const messages = [];
  const api = load("queue.js", {
    "node:fs": { readFileSync: () => "[]" },
    "@xpadev-net/xml2js": { parseStringPromise: async () => [] },
    "./conversion-session": { ConversionSession },
    "./controller-window": {
      sendMessageToController: (message) => messages.push(message),
    },
    "./renderer-window": {
      createRendererWindow(onFailure) {
        rendererFailures.push(onFailure);
        if (windowError) throw new Error("window creation failed");
        const renderer = {
          webContents: { id: nextRendererId++ },
          destroyed: false,
          isDestroyed() {
            return this.destroyed;
          },
          destroy() {
            this.destroyed = true;
          },
          messages: [],
        };
        renderers.push(renderer);
        return renderer;
      },
      closeRendererWindow: (renderer) => renderer.destroy(),
      sendMessageToRenderer: (renderer, message) =>
        renderer.messages.push(message),
    },
    "./lib/json": { encodeError: String },
    "./lib/log": { getLogger: () => logger },
    "./lib/niconico": {},
    "./lib/niconico/dmc": {},
    "./lib/niconico/dms": {},
  });
  return {
    api,
    backends,
    renderers,
    rendererFailures,
    messages,
    ConversionSession,
  };
}

test("consecutive conversions isolate end markers, buffered frames, IPC and progress", async () => {
  const { api, backends, renderers } = harness();
  const first = queue("first");
  const second = queue("second");
  api.appendQueue(first);
  api.appendQueue(second);
  const { sessionId: firstId } = await api.processOnLoad(1);
  api.appendFrame(1, firstId, 2, Uint8Array.of(2));
  api.appendFrame(1, firstId, 1, Uint8Array.of(1));
  await tick();
  // Renderer sends end after awaiting all blob IPC requests.
  api.markAsCompleted(1, firstId, 2);
  await tick();
  assert.equal(backends[0].inputStream.writableEnded, true);
  assert.deepEqual(backends[0].chunks, [[1], [2]]);
  backends[0].complete();
  await tick();
  assert.equal(first.status, "completed");
  assert.equal(renderers[0].destroyed, true);
  assert.equal(second.status, "processing");
  const { sessionId: secondId } = await api.processOnLoad(2);
  assert.notEqual(firstId, secondId);
  assert.equal(await api.processOnLoad(1), undefined);
  api.appendFrame(2, firstId, 1, Uint8Array.of(99));
  api.appendFrame(1, secondId, 1, Uint8Array.of(99));
  api.markAsCompleted(2, firstId, 0);
  api.markAsCompleted(1, secondId, 0);
  api.appendFrame(2, secondId, 1, Uint8Array.of(3));
  api.appendFrame(2, secondId, 2, Uint8Array.of(4));
  await tick();
  // The first session's endFrame=2 must not close the second input.
  assert.equal(backends[1].inputStream.writableEnded, false);
  api.markAsCompleted(2, secondId, 3);
  api.appendFrame(2, secondId, 3, Uint8Array.of(5));
  await tick();
  assert.deepEqual(backends[1].chunks, [[3], [4], [5]]);
  assert.equal(backends[1].inputStream.writableEnded, true);
  assert.equal(first.progress.processed, 2);
  assert.equal(second.progress.processed, 3);
  backends[1].complete();
  await tick();
  assert.equal(second.status, "completed");
  assert.equal(api.isConversionProcessing(), false);
});

test("interrupt waits for FFmpeg and stream cleanup despite appending more jobs", async () => {
  const { api, backends, renderers, messages } = harness({
    stalled: true,
    delayedDestroy: true,
  });
  const first = queue("first");
  const second = queue("second");
  api.appendQueue(first);
  const { sessionId } = await api.processOnLoad(1);
  api.appendFrame(1, sessionId, 1, Uint8Array.of(1));
  api.appendFrame(1, sessionId, 2, Uint8Array.of(2));
  api.appendFrame(1, sessionId, 4, Uint8Array.of(99));
  await tick();
  api.processOnInterrupt(first.id);
  api.processOnInterrupt(first.id);
  api.appendQueue(second);
  api.appendFrame(1, sessionId, 3, Uint8Array.of(99));
  assert.equal(backends[0].stops, 1);
  assert.equal(first.status, "processing");
  assert.equal(second.status, "queued");
  assert.equal(api.isConversionProcessing(), true);
  assert.equal(await api.processOnLoad(1), undefined);
  backends[0].fail(new Error("FFmpeg interrupted"));
  await tick();
  assert.equal(backends.length, 1);
  assert.equal(first.status, "processing");
  backends[0].finishDestroy();
  await tick();
  assert.equal(first.status, "interrupted");
  assert.equal(second.status, "processing");
  assert.equal(backends.length, 2);
  assert.equal(renderers[0].destroyed, true);
  assert.deepEqual(backends[0].chunks, [[1]]);
  assert.equal(first.progress.processed, 0);
  assert.equal(
    messages.filter((message) => message.type === "message").length,
    0,
  );
  const { sessionId: nextId } = await api.processOnLoad(2);
  api.appendFrame(1, sessionId, 1, Uint8Array.of(99));
  api.appendFrame(2, nextId, 1, Uint8Array.of(3));
  await tick();
  assert.deepEqual(backends[1].chunks, [[3]]);
  backends[1].complete();
  await tick();
  backends[1].finishDestroy();
  await tick();
  assert.equal(second.status, "completed");
});

test("frame write failure stops the owning converter and reports failure before continuing", async () => {
  const { api, backends, messages } = harness({ writeError: true });
  const first = queue("first");
  const second = queue("second");
  api.appendQueue(first);
  api.appendQueue(second);
  const { sessionId } = await api.processOnLoad(1);
  api.appendFrame(1, sessionId, 1, Uint8Array.of(1));
  await tick();
  assert.equal(backends[0].stops, 1);
  assert.equal(second.status, "queued");
  backends[0].fail(new Error("FFmpeg shutdown failed"));
  await tick();
  assert.equal(first.status, "fail");
  assert.equal(second.status, "processing");
  assert.equal(
    messages.filter((message) => message.type === "message").length,
    1,
  );
  assert.ok(
    messages
      .find((message) => message.type === "message")
      .message.includes("write failed"),
  );
  backends[1].complete();
  await tick();
});

test("an empty conversion closes input when end arrives without any frames", async () => {
  const { ConversionSession, backends } = harness();
  const session = new ConversionSession(queue("empty"), () => {});
  const finished = session.run();
  session.markAsCompleted(0);
  await tick();
  assert.equal(backends[0].inputStream.writableEnded, true);
  backends[0].complete();
  await finished;
});

function loadProcessConverter(child, onSpawn = () => {}) {
  child.pid = 12345;
  child.exitCode = null;
  child.signalCode = null;
  const runner = load("lib/spawn.js", {
    "node:child_process": {
      spawn: () => {
        onSpawn();
        return child;
      },
    },
  });
  return load("ffmpeg-stream/stream.js", {
    "../lib/spawn": runner,
    "../assets": { ffmpegPath: "ffmpeg" },
    "../lib/log": { getLogger: () => logger },
  }).Converter;
}

test("FFmpeg stop before spawn prevents process creation", async () => {
  let spawned = false;
  const Converter = loadProcessConverter(new EventEmitter(), () => {
    spawned = true;
  });
  const converter = new Converter();
  converter.createInputFromFile("movie.mp4", {});
  const input = converter.createInputStream({});
  const finished = converter.run();
  input.destroy();
  converter.stop();
  await assert.rejects(finished, { name: "AbortError", cancelled: true });
  assert.equal(spawned, false);
});

test("interrupt discards buffered frames and end markers before the next conversion", async () => {
  const { api, backends } = harness();
  const first = queue("first");
  const second = queue("second");
  api.appendQueue(first);
  const { sessionId: firstId } = await api.processOnLoad(1);
  api.appendFrame(1, firstId, 3, Uint8Array.of(99));
  api.markAsCompleted(1, firstId, 4);
  api.processOnInterrupt(first.id);
  api.appendQueue(second);
  backends[0].complete();
  await tick();
  const { sessionId: secondId } = await api.processOnLoad(2);
  for (let frame = 1; frame <= 4; frame++) {
    api.appendFrame(2, secondId, frame, Uint8Array.of(frame));
  }
  await tick();
  assert.deepEqual(backends[1].chunks, [[1], [2], [3], [4]]);
  assert.equal(backends[1].inputStream.writableEnded, false);
  api.markAsCompleted(2, secondId, 4);
  await tick();
  assert.equal(backends[1].inputStream.writableEnded, true);
  backends[1].complete();
  await tick();
});

test("destroying input closes the FFmpeg pipe while waiting for process close", async () => {
  const child = new EventEmitter();
  child.kill = () => true;
  const pipe = new Writable({
    write(_, __, callback) {
      callback();
    },
  });
  child.stdio = [null, null, null, pipe];
  const Converter = loadProcessConverter(child);
  const converter = new Converter();
  const input = converter.createInputStream({});
  let settled = false;
  const finished = converter.run().finally(() => {
    settled = true;
  });
  const rejected = assert.rejects(finished, {
    name: "AbortError",
    cancelled: true,
  });
  await tick();
  input.destroy();
  converter.stop();
  await tick();
  assert.equal(pipe.closed, true);
  assert.equal(settled, false);
  child.emit("exit", 255, null);
  await tick();
  assert.equal(settled, false);
  child.emit("close", 255, null);
  await rejected;
});

test("normal input completion drains the last frame before closing the FFmpeg pipe", async () => {
  const child = new EventEmitter();
  child.kill = () => true;
  let flushWrite;
  const pipe = new Writable({
    write(_, __, callback) {
      flushWrite = callback;
    },
  });
  child.stdio = [null, null, null, pipe];
  const Converter = loadProcessConverter(child);
  const converter = new Converter();
  const input = converter.createInputStream({});
  const finished = converter.run();
  await tick();
  input.end(Uint8Array.of(1));
  await tick();
  try {
    assert.equal(pipe.destroyed, false);
    assert.equal(pipe.writableFinished, false);
    flushWrite();
    await tick();
    assert.equal(pipe.writableFinished, true);
  } finally {
    child.emit("close", 0, null);
    await finished;
  }
});

test("renderer failure stops its session, waits for FFmpeg, and ignores late lifecycle errors", async () => {
  const { api, backends, renderers, rendererFailures, messages } = harness({
    stalled: true,
  });
  const first = queue("failed"),
    second = queue("next");
  api.appendQueue(first);
  api.appendQueue(second);
  const { sessionId } = await api.processOnLoad(1);
  assert.equal(api.isRendererSender(renderers[0].webContents), true);
  api.appendFrame(1, sessionId, 1, Uint8Array.of(1));
  await tick();
  rendererFailures[0](new Error("renderer crashed"));
  rendererFailures[0](new Error("duplicate failure"));
  assert.equal(backends[0].stops, 1);
  assert.equal(backends[0].inputStream.destroyed, true);
  assert.equal(renderers[0].destroyed, true);
  assert.equal(api.isRendererSender(renderers[0].webContents), false);
  assert.equal(first.status, "processing");
  assert.equal(second.status, "queued");
  backends[0].fail(new Error("FFmpeg terminated unexpectedly: SIGINT"));
  await tick();
  assert.equal(first.status, "fail");
  assert.equal(second.status, "processing");
  assert.equal(api.isRendererSender(renderers[1].webContents), true);
  rendererFailures[0](new Error("late renderer failure"));
  api.failConversion(1, new Error("late IPC"));
  assert.equal(backends[1].stops, 0);
  assert.equal(renderers[1].destroyed, false);
  assert.equal(
    messages.filter((message) => message.type === "message").length,
    1,
  );
  assert.ok(
    messages
      .find((message) => message.type === "message")
      .message.includes("renderer crashed"),
  );
  backends[1].complete();
  await tick();
});

test("renderer failure IPC stops only the owning session", async () => {
  const { api, backends, messages } = harness();
  const first = queue("failed");
  api.appendQueue(first);
  api.failConversion(99, new Error("foreign renderer"));
  assert.equal(backends[0].stops, 0);
  api.failConversion(1, new Error("drawing failed"));
  assert.equal(backends[0].stops, 1);
  backends[0].complete();
  await tick();
  assert.equal(first.status, "fail");
  assert.ok(
    messages
      .find((message) => message.type === "message")
      .message.includes("drawing failed"),
  );
});

test("FFmpeg failure closes the stream and renderer before continuing", async () => {
  const { api, backends, renderers, messages } = harness();
  const first = queue("failed"),
    second = queue("next");
  api.appendQueue(first);
  api.appendQueue(second);
  backends[0].fail(new Error("FFmpeg failed"));
  await tick();
  assert.equal(first.status, "fail");
  assert.equal(backends[0].inputStream.closed, true);
  assert.equal(backends[0].stops, 1);
  assert.equal(renderers[0].destroyed, true);
  assert.equal(second.status, "processing");
  assert.equal(
    messages.filter((message) => message.type === "message").length,
    1,
  );
  backends[1].complete();
  await tick();
});

test("window creation failure stops the converter and preserves the original error", async () => {
  const { api, backends, messages } = harness({ windowError: true });
  const first = queue("failed");
  api.appendQueue(first);
  await tick();
  assert.equal(first.status, "fail");
  assert.equal(backends[0].stops, 1);
  assert.equal(backends[0].inputStream.closed, true);
  assert.ok(
    messages
      .find((message) => message.type === "message")
      .message.includes("window creation failed"),
  );
});

test("FFmpeg pipe errors reach the session input and stop the converter", async () => {
  const child = new EventEmitter();
  child.kill = () => queueMicrotask(() => child.emit("close", null, "SIGTERM"));
  const pipe = new Writable({
    write(_, __, callback) {
      callback();
    },
  });
  child.stdio = [null, null, null, pipe];
  const Converter = loadProcessConverter(child);
  const converter = new Converter();
  const input = converter.createInputStream({});
  let inputError;
  input.on("error", (error) => {
    inputError = error;
    input.destroy();
    converter.stop();
  });
  const finished = converter.run();
  await tick();
  pipe.emit("error", new Error("EPIPE"));
  await assert.rejects(finished, {
    name: "AbortError",
    cancelled: true,
    signal: "SIGTERM",
  });
  assert.equal(inputError.message, "EPIPE");
  assert.equal(input.destroyed, true);
});

test("FFmpeg unexpected signal termination rejects the conversion", async () => {
  const child = new EventEmitter();
  child.kill = () => true;
  child.stdio = [null, null, null];
  const Converter = loadProcessConverter(child);
  const converter = new Converter();
  const finished = converter.run();
  await tick();
  child.emit("close", null, "SIGTERM");
  await assert.rejects(finished, {
    name: "ProcessError",
    cancelled: false,
    signal: "SIGTERM",
  });
});
