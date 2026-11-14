const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { Writable } = require("node:stream");
const { setImmediate: nextTurn } = require("node:timers/promises");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync("build/electron/queue.js", "utf8");

function setup() {
  const conversions = [];
  const converter = {
    startConverter() {
      const writes = [];
      const callbacks = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          writes.push([...chunk]);
          callbacks.push(callback);
        },
      });
      const conversion = { stream, writes, callbacks, endCalls: 0 };
      const end = stream.end;
      stream.end = function (...args) {
        conversion.endCalls++;
        return end.apply(this, args);
      };
      converter.inputStream = stream;
      conversions.push(conversion);
      return new Promise((resolve) => stream.on("finish", resolve));
    },
  };
  const noop = () => {};
  const mocks = {
    "node:fs": require("node:fs"),
    "node:stream": require("node:stream"),
    "@xpadev-net/xml2js": {},
    "./controller-window": { sendMessageToController: noop },
    "./converter": converter,
    "./lib/json": {},
    "./lib/log": { getLogger: () => ({ error: noop }) },
    "./lib/niconico": {},
    "./lib/niconico/dmc": {},
    "./lib/niconico/dms": {},
    "./renderer-window": {
      createRendererWindow: noop,
      sendMessageToRenderer: noop,
    },
  };
  const queue = {};
  runInNewContext(source, {
    exports: queue,
    require(name) {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected import: ${name}`);
      return mocks[name];
    },
    console,
  });
  function addConversion() {
    queue.appendQueue({
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
