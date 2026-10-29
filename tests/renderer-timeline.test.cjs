const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const NiconiComments = require("@xpadev-net/niconicomments").default;

test("renderer precomputes the timeline before checking empty frames", () => {
  const source = readFileSync("src/renderer/renderer.ts", "utf8");
  assert.match(source, /lazy:\s*false/);
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
  const nico = new NiconiComments(renderer, comments, {
    format: "formatted",
    lazy: false,
  });
  assert.equal(nico.timeline[100]?.length, 1);
  assert.equal(nico.timeline[10000]?.length ?? 0, 0);
});
