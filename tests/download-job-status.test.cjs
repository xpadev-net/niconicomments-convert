const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { Writable } = require("node:stream");
const { after, test } = require("node:test");

// Exercise compiled production code with only network, ffmpeg, and Electron
// boundaries replaced. Each loader gets fresh module state for queue isolation.
const build = fs.mkdtempSync(path.join(tmpdir(), "download-job-status-"));
after(() => fs.rmSync(build, { recursive: true, force: true }));
execFileSync(process.execPath, [
  path.join(
    path.dirname(require.resolve("typescript/package.json")),
    "bin",
    "tsc",
  ),
  "-p",
  "electron",
  "--outDir",
  build,
  "--sourceMap",
  "false",
]);
const loadModules = (mocks = {}, globals = {}) => {
  const cache = new Map();
  const load = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(build, `${name}.js`);
    const module = { exports: {} };
    cache.set(name, module);
    const localRequire = (id) => {
      if (!id.startsWith(".")) return require(id);
      let target = path.posix.normalize(
        path.posix.join(path.posix.dirname(name), id),
      );
      if (!fs.existsSync(path.join(build, `${target}.js`))) target += "/index";
      return load(target);
    };
    new Function(
      "require",
      "module",
      "exports",
      ...Object.keys(globals),
      fs.readFileSync(filename, "utf8"),
    )(localRequire, module, module.exports, ...Object.values(globals));
    return module.exports;
  };
  return load;
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
const result = { code: 0, stdout: "", stderr: "" };
const progress = () => ({ percent: 0, total: 0, processed: 0 });
const movie = (id = "movie") => ({
  id,
  type: "movie",
  status: "queued",
  progress: progress(),
  url: "sm9",
  format: { type: "dms", format: ["video", "audio"] },
  path: "movie.mp4",
});
const comment = (id = "comment") => ({
  id,
  type: "comment",
  status: "queued",
  progress: progress(),
  path: "comments.xml",
  metadata: {
    nvComment: {
      threadKey: "key",
      server: "https://example.test",
      params: { language: "ja" },
    },
  },
  option: { type: "simple", threads: [] },
});
const conversion = (dependency, id = "convert") => ({
  id,
  type: "convert",
  status: "queued",
  progress: progress(),
  comment:
    dependency?.type === "comment"
      ? { type: "remote", ref: dependency }
      : { type: "local" },
  movie:
    dependency?.type === "movie"
      ? { type: "remote", ref: dependency, duration: 1 }
      : { type: "local", duration: 1 },
  option: { fps: 30, width: 1920, height: 1080, options: {} },
  wait: dependency ? [dependency.id] : [],
});
const setupQueue = (downloads = {}, mocks = {}, globals = {}) => {
  const notifications = [];
  const converted = [];
  let rendererId = 0;
  const load = loadModules(
    {
      "electron/controller-window": {
        sendMessageToController: (message) =>
          notifications.push(structuredClone(message)),
      },
      "electron/renderer-window": {
        closeRendererWindow: (renderer) => renderer.destroy(),
        createRendererWindow: () => ({
          webContents: { id: ++rendererId },
          isDestroyed: () => false,
          destroy() {},
        }),
        sendMessageToRenderer() {},
      },
      "electron/converter": {
        createConverter: (queue) => ({
          inputStream: new Writable({ write: (_, __, done) => done() }),
          run: async () => {
            converted.push(queue.id);
          },
          stop() {},
        }),
      },
      "electron/lib/log": { getLogger: () => ({ error() {} }) },
      "electron/lib/niconico/index": {
        download: async () => result,
        downloadComment: async () => {},
        ...downloads,
      },
      ...mocks,
    },
    globals,
  );
  return { ...load("electron/queue"), notifications, converted };
};

for (const type of ["movie", "comment"]) {
  const create = type === "movie" ? movie : comment;
  const method = type === "movie" ? "download" : "downloadComment";
  test(`${type}: success completes and releases the dependent conversion`, async () => {
    const pending = deferred();
    const queue = setupQueue({ [method]: () => pending.promise });
    const download = create();
    const convert = conversion(download);
    queue.appendQueue(convert);
    assert.equal(download.status, "processing");
    assert.equal(convert.status, "queued");
    pending.resolve(result);
    await flush();
    assert.equal(download.status, "completed");
    assert.equal(convert.status, "completed");
    assert.deepEqual(queue.converted, [convert.id]);
  });

  test(`${type}: failure notifies once, blocks its conversion, and continues independent jobs`, async () => {
    const queue = setupQueue({
      [method]: async (...args) => {
        const id = type === "movie" ? args[0] : args[0].id;
        if (id === "bad") throw new Error("download failed");
      },
    });
    const download = create("bad");
    if (type === "movie") download.url = "bad";
    const blocked = conversion(download);
    queue.appendQueue(blocked);
    const next = create("good");
    queue.appendQueue(next);
    queue.appendQueue(conversion(undefined, "independent"));
    await flush();
    assert.equal(download.status, "fail");
    assert.equal(blocked.status, "fail");
    assert.equal(next.status, "completed");
    assert.deepEqual(queue.converted, ["independent"]);
    assert.equal(
      queue.notifications.filter((item) => item.type === "message").length,
      1,
    );
  });

  for (const settles of ["resolve", "reject"]) {
    test(`${type}: interruption survives later ${settles} and waits for teardown`, async () => {
      const pending = deferred();
      const signals = [];
      const queue = setupQueue({
        [method]: (...args) => {
          signals.push(args.at(-1));
          return signals.length === 1
            ? pending.promise
            : Promise.resolve(result);
        },
      });
      const download = create();
      const blocked = conversion(download);
      queue.appendQueue(blocked);
      queue.processOnInterrupt(download.id);
      assert.equal(signals[0].aborted, true);
      assert.equal(download.status, "interrupted");
      const latestProgress = queue.notifications
        .filter((item) => item.type === "progress")
        .at(-1);
      assert.equal(
        latestProgress.data.find((item) => item.id === download.id).status,
        "interrupted",
      );
      const next = create("next");
      queue.appendQueue(next);
      assert.equal(next.status, "queued");
      pending[settles](settles === "reject" ? new Error("stopped") : result);
      await flush();
      assert.equal(download.status, "interrupted");
      assert.equal(blocked.status, "interrupted");
      assert.equal(next.status, "completed");
      assert.equal(signals[1].aborted, false);
      assert.deepEqual(queue.converted, []);
      assert.equal(
        queue.notifications.filter((item) => item.type === "message").length,
        0,
      );
    });
  }
}

const metadataDMS = {
  video: { id: "sm9" },
  media: { domand: { accessRightKey: "key" } },
};
const metadataDMC = {
  media: {
    delivery: {
      movie: { contentId: "content", session: { transferPresets: [] } },
    },
  },
};
const accessRights = {
  meta: { status: 201 },
  data: { contentUrl: "https://example.test/movie" },
};
const session = {
  meta: { status: 201, message: "created" },
  data: {
    session: { id: "session", content_uri: "https://example.test/movie" },
  },
};
const response = (data) => ({
  json: async () => data,
  headers: { getSetCookie: () => [] },
});
const cookieMock = {
  getCookies: async () => undefined,
  parseCookie: () => [],
  formatCookies: () => [],
};
const movieArgs = (type, signal) => [
  type === "dms" ? metadataDMS : metadataDMC,
  type === "dms"
    ? movie().format
    : { type: "dmc", format: { audio: "a", video: "v" } },
  "movie.mp4",
  () => {},
  signal,
];

for (const type of ["dms", "dmc"]) {
  const method = type === "dms" ? "downloadDMS" : "downloadDMC";
  const setup = (spawn, fetch, globals = {}) =>
    loadModules(
      {
        "electron/lib/cookie": cookieMock,
        "electron/utils/ffmpeg": { DownloadM3U8: spawn },
      },
      { fetch, ...globals },
    )(`electron/lib/niconico/${type}`)[method];

  test(`${type}: invalid metadata and session reject before starting ffmpeg`, async () => {
    let spawns = 0;
    const download = setup(
      () => {
        spawns++;
      },
      async () => response({ meta: { status: 403 } }),
    );
    const args = movieArgs(type, new AbortController().signal);
    await assert.rejects(download({ media: {} }, ...args.slice(1)), /動画情報/);
    const other = type === "dms" ? metadataDMC : metadataDMS;
    await assert.rejects(download(other, ...args.slice(1)), /見つかりません/);
    await assert.rejects(download(...args), /セッション/);
    assert.equal(spawns, 0);
  });

  test(`${type}: ffmpeg failure reaches the caller`, async () => {
    const failure = new Error("ffmpeg exited with code 1");
    const download = setup(
      () => ({ stop() {}, promise: Promise.reject(failure) }),
      async () => response(type === "dms" ? accessRights : session),
    );
    await assert.rejects(
      download(...movieArgs(type, new AbortController().signal)),
      (error) => error === failure,
    );
  });

  test(`${type}: interruption during session setup prevents ffmpeg from starting`, async () => {
    const controller = new AbortController();
    const pending = deferred();
    let spawns = 0;
    const download = setup(
      () => {
        spawns++;
      },
      () => pending.promise,
    );
    const task = download(...movieArgs(type, controller.signal));
    controller.abort();
    pending.resolve(response(type === "dms" ? accessRights : session));
    await assert.rejects(task, { name: "AbortError" });
    assert.equal(spawns, 0);
  });

  test(`${type}: abort stops ffmpeg and rejects even a late success`, async () => {
    const controller = new AbortController();
    const pending = deferred();
    let stops = 0;
    let started = false;
    const download = setup(
      () => {
        started = true;
        return {
          stop: () => {
            stops++;
          },
          promise: pending.promise,
        };
      },
      async () => response(type === "dms" ? accessRights : session),
    );
    const task = download(...movieArgs(type, controller.signal));
    await flush();
    assert.equal(started, true);
    controller.abort();
    assert.equal(stops, 1);
    pending.resolve(result);
    await assert.rejects(task, { name: "AbortError" });
  });

  test(`${type}: successful download returns the ffmpeg result and clears resources`, async () => {
    const controller = new AbortController();
    let stops = 0;
    const download = setup(
      () => ({
        stop: () => {
          stops++;
        },
        promise: Promise.resolve(result),
      }),
      async () => response(type === "dms" ? accessRights : session),
    );
    assert.equal(await download(...movieArgs(type, controller.signal)), result);
    controller.abort();
    assert.equal(stops, 0);
  });
}

test("dmc: heartbeat failure stops ffmpeg and rejects the download without an unhandled rejection", async () => {
  const pending = deferred();
  let tick;
  let stops = 0;
  let cleared = false;
  const spawnDownload = () => ({
    promise: pending.promise,
    stop: () => {
      stops++;
      pending.reject(new Error("stopped"));
    },
  });
  const load = loadModules(
    {
      "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload },
    },
    {
      fetch: async (url) =>
        response(
          url.includes("_method=PUT") ? { meta: { status: 500 } } : session,
        ),
      setInterval: (callback) => {
        tick = callback;
        return 1;
      },
      clearInterval: () => {
        cleared = true;
      },
    },
  );
  const task = load("electron/lib/niconico/dmc").downloadDMC(
    ...movieArgs("dmc", new AbortController().signal),
  );
  await flush();
  tick();
  await assert.rejects(task, /セッションの更新/);
  assert.equal(stops, 1);
  assert.equal(cleared, true);
});

for (const failure of ["network", "json"]) {
  test(`dmc: ${failure} failure during session cleanup preserves completion and releases the conversion`, async () => {
    const warnings = [];
    let stops = 0;
    const spawnDownload = () => ({
      promise: Promise.resolve(result),
      stop: () => {
        stops++;
      },
    });
    const load = loadModules(
      {
        "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload },
      },
      {
        fetch: async (url) => {
          if (!url.includes("_method=DELETE")) return response(session);
          if (failure === "network") throw new Error("cleanup request failed");
          return {
            json: async () => {
              throw new SyntaxError("invalid JSON");
            },
          };
        },
        console: { warn: (...args) => warnings.push(args) },
      },
    );
    const { downloadDMC } = load("electron/lib/niconico/dmc");
    const queue = setupQueue({
      download: (...args) => downloadDMC(...movieArgs("dmc", args.at(-1))),
    });
    const download = movie();
    download.format = movieArgs("dmc")[1];
    const convert = conversion(download);
    queue.appendQueue(convert);
    await flush();
    assert.equal(download.status, "completed");
    assert.equal(convert.status, "completed");
    assert.deepEqual(queue.converted, [convert.id]);
    assert.equal(
      queue.notifications.filter((item) => item.type === "message").length,
      0,
    );
    assert.equal(warnings.length, 1);
    assert.equal(stops, 0);
  });
}

for (const settles of ["resolve", "reject"]) {
  test(`dmc: interruption during cleanup survives a late ${settles}`, async () => {
    const pending = deferred();
    const warnings = [];
    let deleting = false;
    const spawnDownload = () => ({
      promise: Promise.resolve(result),
      stop() {},
    });
    const load = loadModules(
      {
        "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload },
      },
      {
        fetch: async (url) => {
          if (!url.includes("_method=DELETE")) return response(session);
          deleting = true;
          return pending.promise;
        },
        console: { warn: (...args) => warnings.push(args) },
      },
    );
    const controller = new AbortController();
    const task = load("electron/lib/niconico/dmc").downloadDMC(
      ...movieArgs("dmc", controller.signal),
    );
    await flush();
    assert.equal(deleting, true);
    controller.abort();
    pending[settles](
      settles === "resolve" ? response(session) : new Error("cleanup failed"),
    );
    await assert.rejects(task, { name: "AbortError" });
    assert.equal(warnings.length, 0);
  });
}

test("dmc: a slow heartbeat blocks overlapping ticks and the next PUT uses the updated session", async () => {
  const ffmpeg = deferred();
  const heartbeat = deferred();
  const requests = [];
  const updatedSession = structuredClone(session);
  updatedSession.data.session.version = 2;
  let tick;
  let cleared = false;
  const spawnDownload = () => ({ promise: ffmpeg.promise, stop() {} });
  const load = loadModules(
    {
      "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload },
    },
    {
      fetch: async (url, init) => {
        if (!url.includes("_method=PUT")) return response(session);
        requests.push(JSON.parse(init.body));
        return requests.length === 1
          ? { json: () => heartbeat.promise }
          : response(updatedSession);
      },
      setInterval: (callback) => {
        tick = callback;
        return 1;
      },
      clearInterval: () => {
        cleared = true;
      },
    },
  );
  const task = load("electron/lib/niconico/dmc").downloadDMC(
    ...movieArgs("dmc", new AbortController().signal),
  );
  await flush();
  tick();
  await flush();
  tick();
  tick();
  assert.equal(requests.length, 1);
  heartbeat.resolve(updatedSession);
  await flush();
  tick();
  await flush();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], updatedSession.data);
  ffmpeg.resolve(result);
  assert.equal(await task, result);
  assert.equal(cleared, true);
  tick();
  assert.equal(requests.length, 2);
});

// Control only production timers, so deadline tests do not wait in real time.
const requestTimers = () => {
  const deadlines = new Map();
  const intervals = new Map();
  return {
    globals: {
      setTimeout: (callback, delay) => {
        const timer = { callback, delay };
        deadlines.set(timer, timer);
        return timer;
      },
      clearTimeout: (timer) => deadlines.delete(timer),
      setInterval: (callback) => {
        intervals.set(callback, callback);
        return callback;
      },
      clearInterval: (timer) => intervals.delete(timer),
    },
    tick: () => {
      for (const callback of intervals.values()) callback();
    },
    expire: (delay) => {
      const pending = [...deadlines.values()].filter((i) => i.delay === delay);
      assert.equal(pending.length, 1);
      pending[0].callback();
    },
    assertEmpty: () => {
      assert.equal(deadlines.size, 0);
      assert.equal(intervals.size, 0);
    },
  };
};
const untilAborted = (signal) =>
  new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
  });

for (const outcome of [
  "ffmpeg failure",
  "launch failure",
  "abort after creation",
]) {
  test(`dmc: ${outcome} deletes the session and clears all timers`, async () => {
    const controller = new AbortController();
    const timers = requestTimers();
    const failure = new Error(outcome);
    const deleted = [];
    let spawns = 0;
    const spawnDownload = () => {
      spawns++;
      if (outcome === "launch failure") throw failure;
      return { stop() {}, promise: Promise.reject(failure) };
    };
    const load = loadModules(
      { "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload } },
      {
        ...timers.globals,
        fetch: async (url, init) => {
          if (url.includes("_method=DELETE")) {
            deleted.push({ signal: init.signal, body: JSON.parse(init.body) });
            return response(session);
          }
          return {
            json: async () => {
              if (outcome === "abort after creation") controller.abort();
              return session;
            },
          };
        },
      },
    );
    await assert.rejects(
      load("electron/lib/niconico/dmc").downloadDMC(
        ...movieArgs("dmc", controller.signal),
      ),
      outcome === "abort after creation"
        ? { name: "AbortError" }
        : (error) => error === failure,
    );
    assert.equal(spawns, outcome === "abort after creation" ? 0 : 1);
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0].signal.aborted, false);
    assert.deepEqual(deleted[0].body, session.data);
    timers.assertEmpty();
  });
}

for (const stage of [
  "metadata",
  "tracking",
  "session",
  "heartbeat",
  "cleanup",
]) {
  for (const reason of ["abort", "timeout"]) {
    // Tracking ignores the response body; the other requests parse JSON.
    for (const stalledAt of stage === "tracking"
      ? ["fetch"]
      : ["fetch", "body"]) {
      test(`dmc: ${reason} during ${stage} ${stalledAt} reaches the request and clears timers`, async () => {
        const controller = new AbortController();
        const timers = requestTimers();
        const ffmpeg = deferred();
        const warnings = [];
        let requestSignal;
        let stops = 0;
        const spawnDownload = () => ({
          promise:
            stage === "cleanup" ? Promise.resolve(result) : ffmpeg.promise,
          stop: () => {
            stops++;
            ffmpeg.reject(new DOMException("stopped", "AbortError"));
          },
        });
        const load = loadModules(
          {
            "electron/lib/cookie": cookieMock,
            "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload },
          },
          {
            ...timers.globals,
            console: { warn: (...args) => warnings.push(args) },
            fetch: async (url, init) => {
              const current = url.includes("nicovideo.jp/watch/")
                ? "metadata"
                : url.includes("2ab0cbaa")
                  ? "tracking"
                  : url.includes("_method=PUT")
                    ? "heartbeat"
                    : url.includes("_method=DELETE")
                      ? "cleanup"
                      : "session";
              if (current !== stage) return response(session);
              requestSignal = init.signal;
              if (stalledAt === "fetch") return untilAborted(init.signal);
              return { json: () => untilAborted(init.signal) };
            },
          },
        );
        const args = movieArgs("dmc", controller.signal);
        if (stage === "tracking") {
          args[0] = structuredClone(metadataDMC);
          args[0].media.delivery.trackingId = "tracking";
        }
        const task =
          stage === "metadata"
            ? load("electron/lib/niconico/video").download(
                "sm9",
                args[1],
                args[2],
                args[3],
                args[4],
              )
            : load("electron/lib/niconico/dmc").downloadDMC(...args);
        const checked =
          stage === "cleanup" && reason === "timeout"
            ? task.then((value) => assert.equal(value, result))
            : assert.rejects(task, {
                name: reason === "abort" ? "AbortError" : "TimeoutError",
              });
        await flush();
        if (stage === "heartbeat") {
          timers.tick();
          await flush();
        }
        assert.ok(requestSignal);
        assert.equal(requestSignal.aborted, false);
        if (reason === "abort") controller.abort();
        else timers.expire(stage === "cleanup" ? 5_000 : 30_000);
        await checked;
        assert.equal(requestSignal.aborted, true);
        assert.equal(
          warnings.length,
          stage === "cleanup" && reason === "timeout" ? 1 : 0,
        );
        if (stage === "heartbeat") assert.ok(stops >= 1);
        timers.assertEmpty();
      });
    }
  }
}

test("dmc: completion drains an in-flight heartbeat before deleting the latest session", async () => {
  const timers = requestTimers();
  const ffmpeg = deferred();
  const controller = new AbortController();
  let heartbeatSignal;
  let heartbeatDrained = false;
  let deletes = 0;
  let stops = 0;
  const spawnDownload = () => ({
    promise: ffmpeg.promise,
    stop: () => {
      stops++;
    },
  });
  const load = loadModules(
    { "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload } },
    {
      ...timers.globals,
      fetch: async (url, init) => {
        if (url.includes("_method=PUT")) {
          heartbeatSignal = init.signal;
          return {
            json: () =>
              untilAborted(init.signal).finally(() => {
                heartbeatDrained = true;
              }),
          };
        }
        if (url.includes("_method=DELETE")) {
          assert.equal(heartbeatDrained, true);
          assert.deepEqual(JSON.parse(init.body), session.data);
          deletes++;
        }
        return response(session);
      },
    },
  );
  const task = load("electron/lib/niconico/dmc").downloadDMC(
    ...movieArgs("dmc", controller.signal),
  );
  await flush();
  timers.tick();
  await flush();
  ffmpeg.resolve(result);
  assert.equal(await task, result);
  assert.equal(heartbeatSignal.aborted, true);
  assert.equal(deletes, 1);
  controller.abort();
  assert.equal(stops, 0);
  timers.assertEmpty();
});

for (const interrupted of [false, true]) {
  test(`dmc: ${interrupted ? "interrupted" : "failed"} job waits for process exit and session cleanup before starting the next job`, async () => {
    const ffmpeg = deferred();
    const cleanup = deferred();
    const timers = requestTimers();
    const failure = new Error("download failed");
    let deleting = false;
    let nextStarted = false;
    let stopRequested = false;
    let heartbeatSignal;
    const spawnDownload = () => ({
      promise: ffmpeg.promise,
      stop: () => {
        stopRequested = true;
      },
    });
    const load = loadModules(
      { "electron/utils/ffmpeg": { DownloadM3U8: spawnDownload } },
      {
        ...timers.globals,
        fetch: async (url, init) => {
          if (url.includes("_method=PUT")) {
            heartbeatSignal = init.signal;
            if (!interrupted) throw failure;
            return untilAborted(init.signal);
          }
          if (url.includes("_method=DELETE")) {
            deleting = true;
            assert.equal(init.signal.aborted, false);
            return cleanup.promise;
          }
          return response(session);
        },
      },
    );
    const queue = setupQueue({
      download: (...args) => {
        if (args[0] === "next") {
          nextStarted = true;
          return Promise.resolve(result);
        }
        return load("electron/lib/niconico/dmc").downloadDMC(
          ...movieArgs("dmc", args.at(-1)),
        );
      },
    });
    const first = movie();
    const next = movie("next");
    next.url = "next";
    queue.appendQueue(first);
    queue.appendQueue(next);
    await flush();
    timers.tick();
    await flush();
    if (interrupted) queue.processOnInterrupt(first.id);
    await flush();
    assert.equal(stopRequested, true);
    assert.equal(heartbeatSignal.aborted, true);
    assert.equal(deleting, false);
    assert.equal(nextStarted, false);
    ffmpeg.reject(new Error("process exited"));
    await flush();
    assert.equal(deleting, true);
    assert.equal(nextStarted, false);
    cleanup.resolve(response(session));
    await flush();
    assert.equal(first.status, interrupted ? "interrupted" : "fail");
    assert.equal(next.status, "completed");
    assert.equal(nextStarted, true);
    timers.assertEmpty();
  });
}

test("movie metadata failure is handled by the queue with a single notification", async () => {
  const load = loadModules({
    "electron/lib/niconico/utils": { getMetadata: async () => undefined },
    "electron/lib/niconico/dms": {},
    "electron/lib/niconico/dmc": {},
  });
  const queue = setupQueue({
    download: load("electron/lib/niconico/video").download,
  });
  const download = movie();
  queue.appendQueue(conversion(download));
  await flush();
  assert.equal(download.status, "fail");
  assert.deepEqual(queue.converted, []);
  assert.equal(
    queue.notifications.filter((item) => item.type === "message").length,
    1,
  );
});

test("interruption while reading movie metadata prevents the download", async () => {
  const pending = deferred();
  let downloads = 0;
  const load = loadModules({
    "electron/lib/niconico/utils": { getMetadata: () => pending.promise },
    "electron/lib/niconico/dms": {
      downloadDMS: () => {
        downloads++;
      },
    },
    "electron/lib/niconico/dmc": {},
  });
  const controller = new AbortController();
  const task = load("electron/lib/niconico/video").download(
    "sm9",
    movie().format,
    "movie.mp4",
    () => {},
    controller.signal,
  );
  controller.abort();
  pending.resolve(metadataDMS);
  await assert.rejects(task, { name: "AbortError" });
  assert.equal(downloads, 0);
});

const commentModules = (globals = {}, mocks = {}) =>
  loadModules(
    {
      "electron/utils": { sleep: async () => {} },
      ...mocks,
    },
    globals,
  )("electron/lib/niconico/comments/comments");

test("comment fetch and file write failures reach the queue exactly once", async () => {
  for (const failure of ["fetch", "write"]) {
    const { downloadComment } = commentModules({
      fetch: async () => {
        if (failure === "fetch") throw new Error("network failed");
        return response({ data: { threads: [] } });
      },
    });
    const queue = setupQueue({ downloadComment });
    const download = comment();
    download.path = path.join(build, "missing-directory", "comments.xml");
    queue.appendQueue(conversion(download));
    await flush();
    assert.equal(download.status, "fail");
    assert.deepEqual(queue.converted, []);
    assert.equal(
      queue.notifications.filter((item) => item.type === "message").length,
      1,
    );
    assert.equal(fs.existsSync(download.path), false);
  }
});

test("simple and custom comments are not saved after interruption during a request", async () => {
  for (const type of ["simple", "custom"]) {
    const pending = deferred();
    const controller = new AbortController();
    const { downloadComment } = commentModules({
      fetch: () => pending.promise,
    });
    const download = comment();
    download.path = path.join(build, `${type}.xml`);
    download.option = {
      type,
      threads: [{ enable: true, threadId: "1", forkLabel: "main" }],
      start: new Date().toISOString(),
      end: { type: "count", count: 100 },
    };
    const task = downloadComment(download, () => {}, controller.signal);
    controller.abort();
    pending.resolve(response({ data: { threads: [] } }));
    await assert.rejects(task, { name: "AbortError" });
    assert.equal(fs.existsSync(download.path), false);
  }
});

test("custom comments reject interruption between threads without saving partial results", async () => {
  const controller = new AbortController();
  let threads = 0;
  const { downloadComment } = commentModules(
    {},
    {
      "electron/utils": {
        sleep: async () => {
          controller.abort();
        },
      },
      "electron/lib/niconico/comments/custom-comment-downloader": {
        downloadCustomComment: async () => {
          threads++;
          return [];
        },
      },
    },
  );
  const download = comment();
  download.path = path.join(build, "partial.xml");
  download.option = {
    type: "custom",
    threads: [{ enable: true }, { enable: true }],
    start: new Date().toISOString(),
    end: { type: "count", count: 100 },
  };
  await assert.rejects(
    downloadComment(download, () => {}, controller.signal),
    { name: "AbortError" },
  );
  assert.equal(threads, 1);
  assert.equal(fs.existsSync(download.path), false);
});

test("process launch failure rejects instead of emitting an unhandled error", async () => {
  const { spawn } = loadModules()("electron/lib/spawn");
  await assert.rejects(
    spawn(path.join(build, "missing-ffmpeg")).promise,
    (error) => error.cause?.code === "ENOENT",
  );
});

test("conversion interruption is preserved when the converter rejects", async () => {
  const pending = deferred();
  const queue = setupQueue(
    {},
    {
      "electron/converter": {
        createConverter: () => ({
          inputStream: new Writable({ write: (_, __, done) => done() }),
          run: () => pending.promise,
          stop() {},
        }),
      },
    },
  );
  const convert = conversion();
  queue.appendQueue(convert);
  queue.processOnInterrupt(convert.id);
  pending.reject(new Error("interrupted"));
  await flush();
  assert.equal(convert.status, "interrupted");
  assert.equal(
    queue.notifications.filter((item) => item.type === "message").length,
    0,
  );
});
