const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough, Writable } = require("node:stream");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");

const logger = { error() {}, debug() {}, log() {} };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const queueItem = (id) => ({
  id,
  type: "convert",
  status: "queued",
  progress: {},
  comment: { type: "local" },
  movie: { type: "local", duration: 1 },
  option: { fps: 2 },
});
const queueHarness = (
  write = (_data, _encoding, callback) => callback(),
  createWindow = () => {},
) => {
  const sessions = [],
    messages = [],
    failures = [];
  let closes = 0;
  const queue = load("electron/queue.ts", {
    "@xpadev-net/xml2js": {},
    "./controller-window": {
      sendMessageToController: (message) => messages.push(message),
    },
    "./converter": {
      startConverter() {
        const completion = deferred();
        const session = {
          ...completion,
          inputStream: new Writable({ write }),
          stops: 0,
          stop() {
            this.stops++;
            this.inputStream.destroy();
          },
        };
        // The production stop callback does not rely on its receiver.
        session.stop = session.stop.bind(session);
        sessions.push(session);
        return session;
      },
    },
    "./lib/json": { encodeError: (error) => String(error) },
    "./lib/log": { getLogger: () => logger },
    "./lib/niconico": {},
    "./lib/niconico/dmc": {},
    "./lib/niconico/dms": {},
    "./renderer-window": {
      createRendererWindow: (failure) => {
        failures.push(failure);
        createWindow();
      },
      closeRendererWindow: () => closes++,
      sendMessageToRenderer() {},
    },
  });
  return {
    ...queue,
    sessions,
    messages,
    failures,
    get closes() {
      return closes;
    },
  };
};

test("renderer failure tears down once, waits for FFmpeg, and isolates the next queue", async () => {
  let lateWrite;
  const harness = queueHarness((_data, _encoding, callback) => {
    lateWrite = callback;
  });
  const first = queueItem("first"),
    second = queueItem("second");
  harness.appendQueue(first);
  harness.appendQueue(second);
  harness.appendFrame(2, new Uint8Array([2]));
  harness.appendFrame(1, new Uint8Array([1]));
  await tick();
  const oldFailure = harness.failures[0];
  oldFailure(new Error("renderer crashed"));
  oldFailure(new Error("duplicate"));
  assert.equal(first.status, "fail");
  assert.equal(harness.sessions[0].inputStream.destroyed, true);
  assert.equal(harness.messages.filter((m) => m.type === "message").length, 1);
  harness.appendQueue(queueItem("third"));
  assert.equal(harness.sessions.length, 1, "wait for old FFmpeg to exit");
  harness.sessions[0].resolve();
  await tick();
  assert.equal(second.status, "processing");
  assert.equal(harness.sessions.length, 2);
  lateWrite(new Error("old input failure"));
  oldFailure(new Error("late crash"));
  await tick();
  assert.equal(second.status, "processing");
  assert.equal(second.progress.processed, 0);
  // No frame 2 from the first session should fill this session's gap.
  harness.appendFrame(1, new Uint8Array([3]));
  await tick();
  assert.equal(second.progress.processed, 0);
  lateWrite();
  await tick();
  assert.equal(second.progress.processed, 1);
  harness.processOnInterrupt(second.id);
  harness.sessions[1].resolve();
  await tick();
  harness.processOnInterrupt("third");
  harness.sessions[2].resolve();
  await tick();
});

for (const failure of ["ffmpeg", "input"]) {
  test(`${failure} failure fails the queue and destroys both sides`, async () => {
    const harness = queueHarness();
    const queue = queueItem("first");
    harness.appendQueue(queue);
    const session = harness.sessions[0];
    if (failure === "ffmpeg") session.reject(new Error("ffmpeg failed"));
    else session.inputStream.destroy(new Error("input failed"));
    await tick();
    assert.equal(queue.status, "fail");
    assert.equal(session.inputStream.destroyed, true);
    assert.ok(session.stops > 0);
    assert.ok(harness.closes > 0);
    assert.equal(
      harness.messages.filter((m) => m.type === "message").length,
      1,
    );
    session.resolve();
    await tick();
  });
}

test("end received after the last frame closes the input and completes normally", async () => {
  const harness = queueHarness();
  const first = queueItem("first"),
    second = queueItem("second");
  harness.appendQueue(first);
  harness.appendQueue(second);
  harness.appendFrame(2, new Uint8Array([2]));
  harness.appendFrame(1, new Uint8Array([1]));
  await tick();
  assert.equal(first.progress.processed, 2);
  assert.equal(harness.sessions[0].inputStream.writableEnded, false);
  harness.markAsCompleted(2);
  await tick();
  assert.equal(harness.sessions[0].inputStream.writableEnded, true);
  harness.sessions[0].resolve();
  await tick();
  assert.equal(first.status, "completed");
  harness.markAsCompleted(0);
  await tick();
  assert.equal(harness.sessions[1].inputStream.writableEnded, true);
  harness.sessions[1].resolve();
  await tick();
  assert.equal(second.status, "completed");
});

test("window creation failure stops FFmpeg and preserves the original error", async () => {
  const harness = queueHarness(undefined, () => {
    throw new Error("window creation failed");
  });
  const queue = queueItem("first");
  harness.appendQueue(queue);
  assert.equal(queue.status, "fail");
  assert.equal(harness.sessions[0].inputStream.destroyed, true);
  assert.ok(harness.sessions[0].stops > 0);
  assert.ok(
    harness.messages
      .find((m) => m.type === "message")
      .message.includes("window creation failed"),
  );
  harness.sessions[0].reject(new Error("FFmpeg terminated"));
  await tick();
  assert.equal(harness.messages.filter((m) => m.type === "message").length, 1);
});

test("interrupt does not wait for a blocked frame write", async () => {
  const harness = queueHarness(() => {});
  const queue = queueItem("first");
  harness.appendQueue(queue);
  harness.appendFrame(1, new Uint8Array([1]));
  await tick();
  harness.processOnInterrupt(queue.id);
  assert.equal(queue.status, "interrupted");
  assert.equal(harness.sessions[0].inputStream.destroyed, true);
  assert.ok(harness.sessions[0].stops > 0);
  harness.sessions[0].reject(new Error("terminated"));
  await tick();
  assert.equal(queue.status, "interrupted");
  assert.equal(
    harness.messages.some((m) => m.type === "message"),
    false,
  );
});

const converterHarness = () => {
  const children = [];
  const { Converter } = load("electron/ffmpeg-stream/stream.ts", {
    "node:child_process": {
      spawn() {
        const child = new EventEmitter();
        child.stdio = [null, null, null, new PassThrough()];
        child.stderr = new PassThrough();
        child.kill = (signal = "SIGTERM") => {
          queueMicrotask(() => child.emit("exit", null, signal));
          return true;
        };
        children.push(child);
        return child;
      },
    },
    "../assets": { ffmpegPath: "ffmpeg" },
    "../lib/log": { getLogger: () => logger },
  });
  const { startConverter } = load("electron/converter.ts", {
    "./ffmpeg-stream/stream": { Converter },
    "./const": { defaultOptions: {} },
    "./store": { store: { get() {} } },
  });
  const start = () =>
    startConverter({
      movie: { path: "input" },
      output: { path: "output" },
      option: { fps: 30, width: 1920, height: 1080 },
    });
  return { start, children };
};

test("cancellation before FFmpeg spawn still terminates the process", async () => {
  const { start, children } = converterHarness();
  const session = start();
  session.stop();
  await assert.rejects(session.promise, /FFmpeg terminated unexpectedly/);
  assert.equal(children.length, 1);
  assert.equal(session.inputStream.destroyed, true);
});

test("FFmpeg pipe errors propagate to the session input", async () => {
  const { start, children } = converterHarness();
  const session = start();
  session.inputStream.on("error", () => session.stop());
  await tick();
  children[0].stdio[3].emit("error", new Error("EPIPE"));
  await assert.rejects(session.promise, /FFmpeg terminated unexpectedly/);
  assert.equal(session.inputStream.destroyed, true);
});
