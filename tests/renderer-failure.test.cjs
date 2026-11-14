const assert = require("node:assert/strict");
const { test } = require("node:test");
const renderer = require("./helpers/renderer.cjs");
const runRenderer = (options) => renderer(options).run();

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
  assert.ok(
    requests
      .filter((request) => request.type === "blob" || request.type === "end")
      .every((request) => request.sessionId === "test-session"),
  );
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
