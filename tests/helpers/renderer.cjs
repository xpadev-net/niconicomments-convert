const assert = require("node:assert/strict");
const load = require("./load-typescript.cjs");

const logger = { error() {}, warn() {}, debug() {} };

module.exports = (options = {}) => {
  const requests = [];
  let listener;
  let removed = false;
  let draws = 0;
  let blobs = 0;
  const window = {
    api: {
      async request(request) {
        requests.push(request);
        if (options.request) return options.request(request);
        if (request.type === "load") {
          if (options.loadError) throw new Error("load failed");
          return {
            sessionId: "test-session",
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
      else callback(new Blob([options.blobData?.(blobs) ?? "frame"]));
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
      "@xpadev-net/niconicomments": {
        default: options.NiconiComments ?? NiconiComments,
      },
      "@/renderer/comment-utils": {
        ...load("src/renderer/comment-utils.ts", {}),
      },
      "@/type-guard": {
        ...load("src/type-guard.ts", {}),
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
  return {
    requests,
    get blobCount() {
      return blobs;
    },
    respond: (message) => listener?.(null, { target: "renderer", ...message }),
    async run() {
      await setupRenderer();
      assert.equal(removed, true);
      assert.equal(window.onbeforeunload, null);
      return requests;
    },
  };
};
