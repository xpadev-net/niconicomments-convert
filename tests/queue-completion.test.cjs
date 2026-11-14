const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { Writable } = require("node:stream");
const { setImmediate: nextTurn } = require("node:timers/promises");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync("build/electron/queue.js", "utf8");
const sessionSource = readFileSync(
  "build/electron/conversion-session.js",
  "utf8",
);

function setup() {
  const conversions = [];
  const converter = {
    createConverter(job) {
      const writes = [];
      const callbacks = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          writes.push([...chunk]);
          callbacks.push(callback);
        },
      });
      const conversion = { job, stream, writes, callbacks, endCalls: 0 };
      const end = stream.end;
      stream.end = function (...args) {
        conversion.endCalls++;
        return end.apply(this, args);
      };
      conversions.push(conversion);
      return {
        inputStream: stream,
        run: () => new Promise((resolve) => stream.on("finish", resolve)),
        stop: () => stream.destroy(),
      };
    },
  };
  const sessionExports = {};
  runInNewContext(sessionSource, {
    exports: sessionExports,
    require: (name) => (name === "./converter" ? converter : require(name)),
  });
  let currentSession;
  let rendererId = 0;
  const noop = () => {};
  const mocks = {
    "../src/util/frame-timing": require("../build/src/util/frame-timing.js"),
    "node:fs": require("node:fs"),
    "node:stream": require("node:stream"),
    "@xpadev-net/xml2js": {},
    "./controller-window": { sendMessageToController: noop },
    "./conversion-session": {
      ConversionSession: class extends sessionExports.ConversionSession {
        constructor(...args) {
          super(...args);
          currentSession = this;
        }
      },
    },
    "./lib/json": {},
    "./lib/log": { getLogger: () => ({ error: noop }) },
    "./lib/niconico": {},
    "./lib/niconico/dmc": {},
    "./lib/niconico/dms": {},
    "./renderer-window": {
      closeRendererWindow: (renderer) => renderer.destroy(),
      createRendererWindow: () => ({
        webContents: { id: ++rendererId },
        isDestroyed: () => false,
        destroy: noop,
      }),
      sendMessageToRenderer: noop,
    },
  };
  const api = {};
  runInNewContext(source, {
    exports: api,
    require(name) {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected import: ${name}`);
      return mocks[name];
    },
    console,
  });
  const queue = {
    appendFrame: (frameId, data) =>
      api.appendFrame(rendererId, currentSession.id, frameId, data),
    markAsCompleted: (frameId) =>
      api.markAsCompleted(rendererId, currentSession.id, frameId),
    get processingQueue() {
      return conversions.at(-1).job;
    },
  };
  function addConversion() {
    api.appendQueue({
      type: "convert",
      status: "queued",
      progress: {},
      option: { fps: 2 },
      movie: { type: "local", duration: 1 },
      comment: { type: "local" },
    });
  }
  addConversion();
  return { queue, conversions, addConversion };
}

async function completeWrite(conversion) {
  assert.ok(conversion.callbacks.length > 0, "Expected a pending write");
  conversion.callbacks.shift()();
  await nextTurn();
}

test("completion after all frames have been written closes the input", async () => {
  const { queue, conversions } = setup();
  const conversion = conversions[0];
  queue.appendFrame(1, Uint8Array.of(1));
  queue.appendFrame(2, Uint8Array.of(2));
  await nextTurn();
  await completeWrite(conversion);
  await completeWrite(conversion);
  assert.equal(conversion.endCalls, 0);

  queue.markAsCompleted(2);
  await nextTurn();
  assert.equal(conversion.endCalls, 1);
  assert.equal(conversion.stream.writableFinished, true);
  assert.equal(queue.processingQueue.status, "completed");
});

test("completion waits for missing frames and pending writes in order", async () => {
  const { queue, conversions } = setup();
  const conversion = conversions[0];
  queue.markAsCompleted(2);
  queue.appendFrame(2, Uint8Array.of(2));
  await nextTurn();
  assert.deepEqual(conversion.writes, []);
  assert.equal(conversion.endCalls, 0);

  queue.appendFrame(1, Uint8Array.of(1));
  await nextTurn();
  assert.equal(conversion.endCalls, 0);
  await completeWrite(conversion);
  assert.equal(conversion.endCalls, 0);
  await completeWrite(conversion);
  assert.deepEqual(conversion.writes, [[1], [2]]);
  assert.equal(conversion.endCalls, 1);
});

test("repeated completion notifications close the input only once", async () => {
  const { queue, conversions } = setup();
  const conversion = conversions[0];
  queue.appendFrame(1, Uint8Array.of(1));
  queue.markAsCompleted(1);
  queue.markAsCompleted(1);
  await nextTurn();
  assert.equal(conversion.endCalls, 0);
  await completeWrite(conversion);
  queue.markAsCompleted(1);
  await nextTurn();
  assert.equal(conversion.endCalls, 1);
});

test("completion with no frames closes the input", async () => {
  const { queue, conversions } = setup();
  queue.markAsCompleted(0);
  await nextTurn();
  assert.equal(conversions[0].endCalls, 1);
  assert.equal(queue.processingQueue.status, "completed");
});

test("the next conversion starts with fresh completion state", async () => {
  const { queue, conversions, addConversion } = setup();
  addConversion();
  queue.appendFrame(1, Uint8Array.of(1));
  queue.markAsCompleted(1);
  await nextTurn();
  await completeWrite(conversions[0]);
  assert.equal(conversions.length, 2);

  const conversion = conversions[1];
  queue.appendFrame(1, Uint8Array.of(2));
  await nextTurn();
  await completeWrite(conversion);
  assert.equal(conversion.endCalls, 0);
  queue.markAsCompleted(1);
  await nextTurn();
  assert.equal(conversion.endCalls, 1);
  assert.equal(queue.processingQueue.status, "completed");
});
