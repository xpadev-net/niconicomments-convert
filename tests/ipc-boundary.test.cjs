const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");
const schema = require("../build/electron/ipc-schema.js");
const { isIpcRequest } = schema;
const uuid = "b9f2198d-708b-4bfc-a57c-099429c66000";
const progress = { percent: 0, total: 0, processed: 0 };
const baseQueue = { id: uuid, status: "queued", progress };
const movie = {
  ...baseQueue,
  type: "movie",
  url: "sm9",
  path: "movie.mp4",
  format: { type: "dms", format: ["audio", "video"] },
};
const comment = {
  ...baseQueue,
  type: "comment",
  url: "sm9",
  path: "comment.xml",
  option: {
    type: "simple",
    threads: [
      { threadId: 1, fork: 0, enable: true, label: "main", forkLabel: "main" },
    ],
  },
  metadata: {
    server: { url: "https://example.com" },
    keys: { userKey: "key" },
    threads: [],
    nvComment: {
      threadKey: "key",
      server: "https://example.com",
      params: { language: "ja-jp", targets: [{ id: "1", fork: "main" }] },
    },
  },
};
const convert = {
  ...baseQueue,
  type: "convert",
  movie: { type: "remote", path: movie.path, duration: 60, ref: movie },
  comment: {
    type: "remote",
    path: comment.path,
    format: "xml2js",
    ref: comment,
  },
  output: { path: "output.mp4" },
  wait: [uuid],
  option: {
    ss: undefined,
    to: undefined,
    fps: 30,
    width: 1920,
    height: 1080,
    format: "xml2js",
    options: {
      scale: 1,
      mode: "default",
      keepCA: true,
      showCollision: false,
      showCommentCount: false,
    },
  },
};
const controller = (request) => ({ host: "controller", ...request });
const renderer = (request) => ({ host: "renderer", ...request });
const append = (data) => controller({ type: "appendQueue", data });
const clone = (value) => structuredClone(value);

test("all supported IPC requests validate with complete payloads", () => {
  for (const request of [
    ...["selectMovie", "selectComment", "getQueue", "getAvailableProfiles"].map(
      (type) => controller({ type }),
    ),
    controller({
      type: "selectOutput",
      options: {
        title: "Save",
        defaultPath: "out.mp4",
        filters: [{ name: "Movies", extensions: ["mp4"] }],
        properties: ["createDirectory"],
      },
    }),
    controller({
      type: "selectFile",
      pattern: [{ name: "Cookie", extensions: ["txt"] }],
    }),
    controller({ type: "dropFiles", paths: ["movie.mp4", "comment.xml"] }),
    append(convert),
    append(movie),
    append(comment),
    controller({ type: "interruptQueue", queueId: uuid }),
    controller({ type: "getNiconicoMovieMetadata", nicoId: "sm9" }),
    controller({ type: "getSetting", key: "auth" }),
    ...[
      { type: "NoAuth" },
      { type: "cookie", path: "cookies.txt" },
      { type: "browser", profile: undefined },
      {
        type: "browser",
        profile: {
          type: "chromiumProfile",
          browser: "chrome",
          profileName: "Default",
          name: "Chrome",
          path: "profile",
        },
      },
    ].map((data) => controller({ type: "setSetting", key: "auth", data })),
    controller({
      type: "setSetting",
      key: "ffmpegOptions",
      data: { "-c:v": "libx264" },
    }),
    controller({ type: "setSetting", key: "showRendererWindow", data: true }),
    renderer({ type: "load" }),
    renderer({ type: "failure", message: "error" }),
    renderer({ type: "message", title: "Title", message: "error" }),
    renderer({
      type: "blob",
      sessionId: "session",
      frameId: 1,
      data: new Uint8Array([1]),
    }),
    renderer({ type: "end", sessionId: "session", frameId: 1 }),
  ])
    assert.equal(isIpcRequest(request), true, JSON.stringify(request));

  const local = clone(convert);
  local.movie = { type: "local", path: "local.mp4", duration: 60 };
  local.comment = { type: "local", path: "comments.json", format: "rawV1" };
  assert.equal(isIpcRequest(append(local)), true);
  const dmc = {
    ...movie,
    format: { type: "dmc", format: { audio: "a", video: "v" } },
  };
  assert.equal(isIpcRequest(append(dmc)), true);
  const custom = clone(comment);
  custom.option = {
    ...comment.option,
    type: "custom",
    start: "2026-01-01",
    end: { type: "count", count: 1000 },
  };
  assert.equal(isIpcRequest(append(custom)), true);
  custom.option.end = { type: "date", date: "2025-01-01" };
  assert.equal(isIpcRequest(append(custom)), true);
});

test("all video ID prefixes supported by the pickers pass the IPC boundary", () => {
  for (const nicoId of ["sm9", "nm9", "so9", "12345"]) {
    assert.equal(
      isIpcRequest(controller({ type: "getNiconicoMovieMetadata", nicoId })),
      true,
    );
    assert.equal(isIpcRequest(append({ ...movie, url: nicoId })), true);
    assert.equal(isIpcRequest(append({ ...comment, url: nicoId })), true);
  }
});

test("malformed IPC values are rejected without validation throwing", () => {
  const malformed = [
    undefined,
    null,
    false,
    0,
    "request",
    [],
    {},
    { host: "controller" },
    { data: [controller({ type: "getQueue" })] },
    controller({ type: "toString" }),
    controller({ type: "__proto__" }),
    controller({ type: "load" }),
    renderer({ type: "buffer", data: [] }),
    controller({ type: "selectOutput", options: null }),
    controller({ type: "selectOutput", options: { properties: ["invalid"] } }),
    controller({
      type: "selectOutput",
      options: { filters: [{ name: "Movies", extensions: [1] }] },
    }),
    controller({
      type: "selectOutput",
      options: { securityScopedBookmarks: "bad" },
    }),
    controller({ type: "selectFile", pattern: [{}] }),
    controller({ type: "dropFiles", paths: new Array(1) }),
    controller({ type: "dropFiles", paths: [null] }),
    controller({ type: "appendQueue", data: null }),
    controller({ type: "appendQueue", data: {} }),
    controller({ type: "getSetting", key: "auth.path" }),
    controller({ type: "getSetting", key: "__proto__" }),
    controller({ type: "setSetting", key: "showRendererWindow", data: "true" }),
    ...[new Date(), new Map(), new Set(), new Uint8Array()].map((data) =>
      controller({ type: "setSetting", key: "ffmpegOptions", data }),
    ),
    controller({
      type: "setSetting",
      key: "ffmpegOptions",
      data: { "-c:v": 1 },
    }),
    controller({ type: "setSetting", key: "auth", data: { type: "cookie" } }),
    controller({
      type: "setSetting",
      key: "auth",
      data: { type: "browser", profile: {} },
    }),
    controller({ type: "interruptQueue", queueId: "bad-id" }),
    controller({
      type: "getNiconicoMovieMetadata",
      nicoId: "https://evil.test",
    }),
    renderer({ type: "end", sessionId: "s", frameId: -1 }),
    renderer({ type: "end", sessionId: "s", frameId: NaN }),
    renderer({ type: "end", sessionId: "s", frameId: 1.5 }),
    renderer({ type: "blob", sessionId: "s", frameId: 1, data: [1] }),
    renderer({ type: "blob", frameId: 1, data: new Uint8Array([1]) }),
    renderer({ type: "failure", message: null }),
    renderer({ type: "message", title: 1, message: "error" }),
  ];
  for (const value of malformed)
    assert.equal(isIpcRequest(value), false, JSON.stringify(value));
});

test("nested queue payloads cannot pass using only queue discriminants", () => {
  for (const mutate of [
    (q) => {
      delete q.progress;
    },
    (q) => {
      q.progress.processed = "0";
    },
    (q) => {
      q.movie.duration = Infinity;
    },
    (q) => {
      q.option.fps = 0;
    },
    (q) => {
      q.option.width = NaN;
    },
    (q) => {
      q.option.ss = -1;
    },
    (q) => {
      q.option.options.keepCA = "true";
    },
    (q) => {
      q.option.options.config = {};
    },
    (q) => {
      q.option.options.mode = "invalid";
    },
    (q) => {
      q.comment.ref.metadata.nvComment = {};
    },
    (q) => {
      q.comment.ref.option.threads[0].enable = 1;
    },
    (q) => {
      q.comment.ref.option = {
        type: "custom",
        threads: [],
        start: "invalid",
        end: { type: "count", count: 1 },
      };
    },
    (q) => {
      q.movie.ref.format.format = ["audio"];
    },
    (q) => {
      q.wait = [null];
    },
  ]) {
    const value = clone(convert);
    mutate(value);
    assert.equal(isIpcRequest(append(value)), false);
  }
});

const ipcHarness = ({ appendError } = {}) => {
  const calls = [];
  const makeSender = (id, url) => ({
    id,
    mainFrame: { url },
    isDestroyed: () => false,
  });
  const control = makeSender(1, "http://localhost:5173/");
  const render = makeSender(2, "http://localhost:5173/?renderer");
  const unknown = makeSender(3, "http://localhost:5173/");
  let handler;
  const recordCall =
    (name, result) =>
    (...args) => {
      calls.push([name, ...args]);
      return result;
    };
  const { registerListener } = load("electron/ipc-manager.ts", {
    electron: {
      ipcMain: {
        handle(name, callback) {
          assert.equal(name, "request");
          handler = callback;
        },
      },
    },
    "../src/domain/validation": require("../build/src/domain/validation"),
    "./context": { baseUrl: "http://localhost:5173" },
    "./controller-window": {
      isControllerSender: (s) => s === control,
      sendMessageToController: recordCall("message"),
    },
    "./dialog": {
      selectMovie: recordCall("selectMovie", { type: "selectMovie", data: {} }),
      selectOutput: recordCall("selectOutput", "out.mp4"),
      selectFile: recordCall("selectFile", { canceled: true, filePaths: [] }),
      handleDropFiles: recordCall("dropFiles", { type: "dropFiles" }),
    },
    "./ipc-schema": schema,
    "./lib/cookie": {},
    "./lib/niconico": {},
    "./lib/json": { encodeError: String },
    "./lib/log": { getLogger: () => ({ error() {} }) },
    "./queue": {
      isRendererSender: (s) => s === render,
      appendQueue: (queue) => {
        if (appendError) throw appendError;
        calls.push(["appendQueue", queue]);
      },
      failConversion: recordCall("failConversion"),
      appendFrame: recordCall("appendFrame"),
      processOnLoad: recordCall("load", { type: "load", sessionId: "s" }),
    },
    "./store": {
      store: {
        get: recordCall("get", true),
        set: recordCall("set", { notCloneable: () => {} }),
      },
    },
  });
  registerListener();
  return {
    calls,
    control,
    render,
    unknown,
    request: (sender, value, senderFrame = sender.mainFrame) =>
      handler({ sender, senderFrame }, value),
  };
};

test("authenticated requests reach their handler and return the appropriate result", async () => {
  const h = ipcHarness();
  assert.equal(
    await h.request(
      h.control,
      controller({ type: "selectOutput", options: {} }),
    ),
    "out.mp4",
  );
  assert.equal(
    await h.request(
      h.control,
      controller({ type: "getSetting", key: "showRendererWindow" }),
    ),
    true,
  );
  assert.equal(
    await h.request(
      h.control,
      controller({
        type: "setSetting",
        key: "showRendererWindow",
        data: false,
      }),
    ),
    undefined,
  );
  assert.equal(await h.request(h.control, append(convert)), true);
  await h.request(
    h.render,
    renderer({
      type: "blob",
      sessionId: "s",
      frameId: 1,
      data: new Uint8Array([1]),
    }),
  );
  assert.equal(
    h.calls.some(([name]) => name === "appendQueue"),
    true,
  );
  assert.equal(
    h.calls.some(([name]) => name === "appendFrame"),
    true,
  );
});

test("sender identity, role, main frame, and document URL must all match", async () => {
  const h = ipcHarness();
  const request = controller({ type: "selectOutput", options: {} });
  for (const [sender, value, frame] of [
    [h.unknown, request],
    [{ ...h.control }, request],
    [h.control, renderer({ type: "load" })],
    [h.render, request],
    [h.control, request, null],
    [h.control, request, { url: h.control.mainFrame.url }],
    [h.render, renderer({ type: "load" }), { url: h.render.mainFrame.url }],
  ])
    await assert.rejects(
      h.request(sender, value, frame),
      /Unauthorized IPC sender|Invalid IPC request/,
    );
  for (const url of [
    "https://evil.test/",
    "http://localhost:5173/?renderer",
    "http://localhost:5173/other",
    "http://localhost:51730/",
  ]) {
    h.control.mainFrame.url = url;
    await assert.rejects(
      h.request(h.control, request),
      /Unauthorized IPC sender/,
    );
  }
  assert.equal(
    h.calls.some(([name]) => ["selectOutput", "load"].includes(name)),
    false,
  );
});

test("bad envelopes reject safely before privileged handlers execute", async () => {
  const h = ipcHarness();
  for (const value of [
    null,
    undefined,
    {},
    { data: [] },
    controller({ type: "appendQueue", data: {} }),
    controller({ type: "setSetting", key: "auth.path", data: "evil" }),
  ]) {
    await assert.rejects(h.request(h.control, value), /Invalid IPC request/);
  }
  assert.equal(
    h.calls.every(([name]) => name === "message"),
    true,
  );
  await assert.rejects(
    h.request(
      h.render,
      renderer({ type: "blob", sessionId: "s", frameId: 1, data: null }),
    ),
    /Invalid IPC request/,
  );
  assert.equal(h.calls.at(-1)[0], "failConversion");
});

const preloadHarness = (role) => {
  let api;
  const emitter = new EventEmitter();
  const invokes = [];
  load(
    "electron/preload.ts",
    {
      electron: {
        contextBridge: {
          exposeInMainWorld(name, value) {
            assert.equal(name, "api");
            api = value;
          },
        },
        ipcRenderer: {
          on: emitter.on.bind(emitter),
          removeListener: emitter.removeListener.bind(emitter),
          invoke: async (...args) => {
            invokes.push(args);
            return "result";
          },
        },
        webUtils: { getPathForFile: () => "file.mp4" },
      },
    },
    { process: { argv: role ? [`--ipc-role=${role}`] : [] } },
  );
  return { api, emitter, invokes };
};

test("preload exposes capabilities according to the role assigned by main", async () => {
  const control = preloadHarness("controller");
  assert.equal(
    await control.api.request(controller({ type: "getQueue" })),
    "result",
  );
  assert.deepEqual(control.invokes, [
    ["request", controller({ type: "getQueue" })],
  ]);
  await assert.rejects(
    control.api.request(renderer({ type: "load" })),
    /role mismatch/,
  );
  assert.equal(typeof control.api.getPathForFile, "function");
  const render = preloadHarness("renderer");
  assert.equal(render.api.getPathForFile, undefined);
  await assert.rejects(
    render.api.request(controller({ type: "getQueue" })),
    /role mismatch/,
  );
  const download = preloadHarness("downloader");
  assert.equal(download.api.request, undefined);
  assert.equal(download.api.getPathForFile, undefined);
  assert.equal(preloadHarness().api, undefined);
});

test("preload hides Electron events, filters roles, and removes the wrapped callback", () => {
  const h = preloadHarness("controller");
  const calls = [];
  const callback = (...args) => calls.push(args);
  const event = {
    sender: {
      send() {
        throw new Error("privileged API leaked");
      },
    },
  };
  const value = { target: "controller", type: "end" };
  h.api.onResponse(callback);
  h.api.onResponse(callback);
  assert.equal(h.emitter.listenerCount("response"), 1);
  h.emitter.emit("response", event, { target: "renderer", type: "end" });
  h.emitter.emit("response", event, null);
  h.emitter.emit("response", event, value);
  assert.deepEqual(calls, [[undefined, value]]);
  h.api.remove(callback);
  h.api.remove(callback);
  assert.equal(h.emitter.listenerCount("response"), 0);
});

test("legacy non-IPC guards do not throw on null and incomplete objects", () => {
  const { typeGuard } = load("electron/type-guard.ts", {});
  for (const group of Object.values(typeGuard))
    for (const guard of Object.values(group)) {
      for (const value of [
        null,
        undefined,
        {},
        [],
        { profile: null, meta: null, data: null, media: null },
      ])
        assert.doesNotThrow(() => guard(value));
    }
});

test("shared settings validation applies to IPC and rejects invalid migrated-setting writes", () => {
  for (const [key, data, valid] of [
    ["commentFileExt", ".xml", true],
    ["commentFileExt", "xml", false],
    ["auth", { type: "cookie", path: "" }, false],
    ["auth", { type: "cookie", path: "/cookies.txt" }, true],
    [
      "auth",
      {
        type: "browser",
        profile: {
          type: "firefoxContainer",
          browser: "firefox",
          name: "user",
          path: "/profile",
          profileName: "default",
          containerName: "personal",
          contextId: 0,
        },
      },
      false,
    ],
  ]) {
    assert.equal(isIpcRequest(controller({ type: "getSetting", key })), true);
    assert.equal(
      isIpcRequest(controller({ type: "setSetting", key, data })),
      valid,
    );
  }
});

test("domain validation errors reject queue admission and retain the controller's input message", async () => {
  const { ValidationError } = require("../build/src/domain/validation");
  const error = new ValidationError(
    "終了位置は開始位置より後に指定してください。",
  );
  const h = ipcHarness({ appendError: error });
  await assert.rejects(
    h.request(h.control, append(convert)),
    (value) => value === error,
  );
  const message = h.calls.find(([name]) => name === "message")[1];
  assert.equal(message.title, "入力内容を確認してください");
  assert.equal(message.message, error.message);
});
