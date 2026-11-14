const assert = require("node:assert/strict");
const rendererHarness = require("./helpers/renderer.cjs");
const { test } = require("node:test");
const NiconiComments = require("@xpadev-net/niconicomments").default;

test("renderer draws populated frames with the real library and reuses empty frames", async (t) => {
  const previousCanvas = global.HTMLCanvasElement;
  t.after(() => {
    global.HTMLCanvasElement = previousCanvas;
  });
  global.HTMLCanvasElement = class HTMLCanvasElement {};
  const noop = () => {};
  const measure = (text) => ({ width: text.length * 10 });
  const renderer = new Proxy(
    {
      rendererName: "test",
      canvas: {},
      getSize: () => ({ width: 1920, height: 1080 }),
      getFont: () => "",
      getFillStyle: () => "",
      measureText: measure,
      measureTextAtDrawScale: measure,
      getCanvas() {
        return renderer;
      },
    },
    { get: (target, key) => target[key] ?? noop },
  );
  const comments = [
    {
      id: 1,
      vpos: 100,
      content: "hello",
      date: 0,
      date_usec: 0,
      owner: false,
      premium: false,
      mail: [],
      user_id: 1,
      layer: 0,
      ignoreScale: false,
      is_my_post: false,
    },
  ];
  const draws = [];
  const harness = rendererHarness({
    fps: 1,
    duration: 101,
    // Give each Canvas snapshot different bytes to detect stale-image reuse.
    blobData: (count) => Uint8Array.of(count),
    NiconiComments: class extends NiconiComments {
      constructor(_canvas, _data, options) {
        // Keep the real timeline and rendering library; replace only Canvas I/O.
        super(renderer, comments, options);
      }
      drawCanvas(vpos) {
        draws.push(vpos);
        return super.drawCanvas(vpos);
      }
    },
  });
  const requests = await harness.run();
  assert.ok(draws.includes(100), "the comment frame must be drawn");
  assert.ok(!draws.includes(10000), "empty frames must reuse the blank image");
  assert.equal(
    requests.filter((request) => request.type === "blob").length,
    101,
  );
  assert.equal(
    harness.blobCount,
    draws.length + 1,
    "only the initial blank image and populated frames should be encoded",
  );
  const snapshots = new Map(draws.map((vpos, index) => [vpos, index + 2]));
  for (const request of requests.filter(({ type }) => type === "blob")) {
    const vpos = (request.frameId - 1) * 100;
    assert.deepEqual(
      [...request.data],
      [snapshots.get(vpos) ?? 1],
      `frame at ${vpos} must carry its own drawing or the original blank image`,
    );
  }
  assert.equal(requests.at(-1).type, "end");
  assert.equal(requests.at(-1).frameId, 101);
  assert.equal(
    requests.some((request) => request.type === "failure"),
    false,
  );
});
