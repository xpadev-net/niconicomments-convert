const assert = require("node:assert/strict");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");
const { isIpcRequest } = require("../build/electron/ipc-schema.js");

const harness = (duration) =>
  load("electron/dialog.ts", {
    electron: {
      dialog: {
        showOpenDialog: async () => ({
          canceled: false,
          filePaths: ["movie.mp4"],
        }),
      },
    },
    "./assets": { ffprobePath: "ffprobe" },
    "./controller-window": { sendMessageToController() {} },
    "./lib/json": { encodeError: String },
    "./lib/log": { getLogger: () => ({ error() {} }) },
    "./lib/spawn": {
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

for (const duration of ["12.345678", 12.345678])
  test(`local selection and drop normalize ffprobe duration ${typeof duration}`, async () => {
    const api = harness(duration);
    const selected = await api.selectMovie();
    const dropped = await api.handleDropFiles(["movie.mp4"]);
    assert.equal(selected.data.duration, 12.345678);
    assert.equal(dropped.movie.duration, 12.345678);
    const queue = {
      id: "b9f2198d-708b-4bfc-a57c-099429c66000",
      status: "queued",
      type: "convert",
      progress: { percent: 0, total: 0, processed: 0 },
      movie: {
        type: "local",
        path: "movie.mp4",
        duration: selected.data.duration,
      },
      comment: { type: "local", path: "comment.json", format: "formatted" },
      output: { path: "out.mp4" },
      option: {
        ss: undefined,
        to: undefined,
        fps: 30,
        width: 1920,
        height: 1080,
        format: "formatted",
        options: {},
      },
    };
    assert.equal(
      isIpcRequest({ host: "controller", type: "appendQueue", data: queue }),
      true,
    );
  });

for (const duration of ["N/A", "Infinity", "-1", "0"])
  test(`invalid ffprobe duration ${duration} reports an analysis error`, async () => {
    const result = await harness(duration).selectMovie();
    assert.equal(result.type, "message");
  });
