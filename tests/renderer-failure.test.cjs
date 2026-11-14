const assert = require("node:assert/strict");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");

const logger = { error() {}, warn() {}, debug() {} };

const runRenderer = async (options = {}) => {
  const requests = [];
  let listener;
  let removed = false;
  let draws = 0;
  let blobs = 0;
  const window = {
    api: {
      async request(request) {
        requests.push(request);
        if (request.type === "load") {
          if (options.loadError) throw new Error("load failed");
          return {
            queue: {
              comment: { format: "formatted" },
              option: { fps: options.fps ?? 1, width: 1920, height: 1080 },
              movie: { duration: options.duration ?? 2 },
            },
            commentData: "[]",
          };
        }
        if (request.type === "blob" && options.sendError)
          throw new Error("send failed");
        if (request.type === "end")
          listener(null, { target: "renderer", type: "end" });
      },
      onResponse(callback) {
        listener = callback;
      },
      remove(callback) {
        removed = callback === listener;
      },
    },
    close() {},
  };
  const canvas = {
    toBlob(callback) {
      blobs++;
      if (blobs === options.stallBlobAt) return;
      if (blobs === options.nullBlobAt) callback(null);
      else callback(new Blob(["frame"]));
    },
  };
  class NiconiComments {
    constructor() {
      if (options.initError) throw new Error("init failed");
      this.timeline = options.allFrames
        ? new Proxy({}, { get: () => [1] })
        : { 0: [1], 100: [1] };
    }
    drawCanvas() {
      draws++;
      options.onDraw?.(draws);
      if (draws === options.drawErrorAt) throw new Error("draw failed");
    }
  }
  const { setupRenderer } = load(
    "src/renderer/renderer.ts",
    {
      "@xpadev-net/niconicomments": { default: NiconiComments },
      "@/renderer/comment-utils": {
        transformComments: () => ({ format: "formatted", data: [] }),
      },
      "@/type-guard": {
        typeGuard: {
          renderer: {
            reportProgress: (data) => data.type === "reportProgress",
            end: (data) => data.type === "end",
          },
        },
      },
      "@/util/log": { getLogger: () => logger },
      "@/util/sleep": {
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      },
    },
    {
      window,
      document: {
        body: {},
        getElementById: (id) => (id === "canvas" ? canvas : {}),
      },
    },
  );
  await setupRenderer();
  assert.equal(removed, true);
  assert.equal(window.onbeforeunload, null);
  return requests;
};

for (const [name, options, message] of [
  ["load rejection", { loadError: true }, "load failed"],
  ["initialization failure", { initError: true }, "init failed"],
  ["drawing failure in a later batch", { drawErrorAt: 2 }, "draw failed"],
  [
    "asynchronous canvas failure",
    { nullBlobAt: 3 },
    "canvas.toBlob returned null",
  ],
  ["frame IPC rejection", { sendError: true }, "send failed"],
]) {
  test(`renderer reports ${name} as fatal and does not send end`, async () => {
    const requests = await runRenderer(options);
    const failures = requests.filter((request) => request.type === "failure");
    assert.equal(failures.length, 1);
    assert.ok(failures[0].message.includes(message));
    assert.equal(
      requests.some((request) => request.type === "end"),
      false,
    );
  });
}

test("renderer sends all frame IDs and then the final frame count", async () => {
  const requests = await runRenderer();
  assert.deepEqual(
    requests
      .filter((request) => request.type === "blob")
      .map((request) => request.frameId),
    [1, 2],
  );
  assert.equal(requests.find((request) => request.type === "end").frameId, 2);
  assert.equal(
    requests.some((request) => request.type === "failure"),
    false,
  );
});

test("renderer yields to timers between frame draws within a high-FPS batch", async () => {
  let draws = 0;
  let drawsWhenTimerRuns;
  const requests = await runRenderer({
    fps: 60,
    duration: 1,
    allFrames: true,
    onDraw(count) {
      draws = count;
      if (count === 1)
        setTimeout(() => {
          drawsWhenTimerRuns = draws;
        }, 0);
    },
  });
  assert.equal(drawsWhenTimerRuns, 1);
  assert.equal(draws, 60);
  assert.equal(requests.find((request) => request.type === "end").frameId, 60);
  assert.equal(
    requests.some((request) => request.type === "failure"),
    false,
  );
});

test("a rejected frame terminates a yielding batch even if another frame is stalled", {
  timeout: 2000,
}, async () => {
  const requests = await runRenderer({
    fps: 3,
    allFrames: true,
    stallBlobAt: 2,
    nullBlobAt: 3,
  });
  const failures = requests.filter((request) => request.type === "failure");
  assert.equal(failures.length, 1);
  assert.ok(failures[0].message.includes("canvas.toBlob returned null"));
  assert.equal(
    requests.some((request) => request.type === "end"),
    false,
  );
});
