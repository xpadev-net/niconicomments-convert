const assert = require("node:assert/strict");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");
const { getConversionError } = require("../build/src/domain/conversion");

const inspect = async (duration) => {
  const messages = [];
  const { handleDropFiles } = load("electron/dialog.ts", {
    electron: { dialog: {} },
    "../src/domain/validation": require("../build/src/domain/validation"),
    "./assets": { ffprobePath: "ffprobe" },
    "./controller-window": {
      sendMessageToController: (message) => messages.push(message),
    },
    "./lib/json": { encodeError: String },
    "./lib/log": { getLogger: () => ({ error() {} }) },
    "./lib/spawn": {
      ProcessError: class extends Error {},
      spawn: () => ({
        promise: Promise.resolve({
          stdout: JSON.stringify({
            streams: [{ width: 1920, height: 1080, duration }],
          }),
        }),
      }),
    },
    "./store": {},
    "./utils/niconicomments": {},
  });
  return { ...(await handleDropFiles(["/movie.mp4"])), messages };
};

test("FFprobe string durations become domain numbers before reaching the form", async () => {
  for (const duration of ["10.000000", 10]) {
    const response = await inspect(duration);
    assert.equal(response.movie.duration, 10);
    assert.equal(
      getConversionError(
        { fps: 30, width: 1920, height: 1080, options: {} },
        response.movie.duration,
      ),
      undefined,
    );
  }
});

test("invalid FFprobe durations cannot become movie inputs", async () => {
  for (const duration of ["N/A", "Infinity", "", "0", "-1", null, true]) {
    const response = await inspect(duration);
    assert.equal(response.messages[0].type, "message");
    assert.equal(response.movie, undefined);
  }
});
