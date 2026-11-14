const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { registerHooks, stripTypeScriptTypes } = require("node:module");
const { test } = require("node:test");

const converterUrl = new URL(
  "../electron/converter.ts",
  `file://${__filename}`,
);
const constUrl = new URL("../electron/const.ts", converterUrl);
const moduleUrl = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;

for (const saved of [false, true]) {
  test(`consecutive conversions preserve the ${saved ? "saved" : "default"} template`, async () => {
    const storeUrl = moduleUrl(`
      import { defaultOptions } from ${JSON.stringify(constUrl.href)};
      export const template = ${saved ? '{ r: "{FPS}", filter_complex: "scale=w={width}:h={height}", crf: "25", an: "" }' : "defaultOptions"};
      export const store = { get: () => template };
    `);
    const streamUrl = moduleUrl(`
      export const outputs = [];
      export class Converter {
        createInputFromFile() {}
        createInputStream() {}
        output(path, options) { outputs.push(options); }
        async run() {}
      }
      // Separate module instances for each case: ${saved}
    `);
    const entryUrl = `${converterUrl.href}?saved=${saved}`;
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (context.parentURL === entryUrl) {
          const url = {
            "./const": constUrl.href,
            "./store": storeUrl,
            "./ffmpeg-stream/stream": streamUrl,
          }[specifier];
          if (url) return { url, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
      load(url, context, nextLoad) {
        if (url === entryUrl || url === constUrl.href) {
          return {
            format: "module",
            source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8")),
            shortCircuit: true,
          };
        }
        return nextLoad(url, context);
      },
    });

    try {
      const { createConverter } = await import(entryUrl);
      const { defaultOptions } = await import(constUrl.href);
      const { template } = await import(storeUrl);
      const { outputs } = await import(streamUrl);
      const original = template ?? defaultOptions;
      const snapshot = { ...original };
      const queue = (fps, width, height) => ({
        movie: { path: "input.mp4" },
        output: { path: "output.mp4" },
        option: { fps, width, height },
      });

      await createConverter(queue(30, 1920, 1080)).run();
      await createConverter(queue(60, 1280, 720)).run();

      assert.equal(outputs[0].r, "30");
      assert.match(outputs[0].filter_complex, /scale=w=1920:h=1080/);
      assert.equal(outputs[1].r, "60");
      assert.match(outputs[1].filter_complex, /scale=w=1280:h=720/);
      assert.equal(outputs[1].crf, original.crf);
      if (saved) assert.equal(outputs[1].an, "");
      assert.notStrictEqual(outputs[0], original);
      assert.notStrictEqual(outputs[1], original);
      assert.notStrictEqual(outputs[0], outputs[1]);
      assert.deepEqual(original, snapshot);
    } finally {
      hooks.deregister();
    }
  });
}
