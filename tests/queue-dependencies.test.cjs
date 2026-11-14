const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { Writable } = require("node:stream");
const { after, test } = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const temporary = mkdtempSync(path.join(tmpdir(), "queue-dependencies-"));
after(() => rmSync(temporary, { recursive: true, force: true }));
const config = path.join(temporary, "tsconfig.json");
writeFileSync(
  config,
  JSON.stringify({
    extends: path.join(root, "electron/tsconfig.json"),
    compilerOptions: {
      outDir: temporary,
      jsx: "react-jsx",
      // Type checking runs separately; these tests execute the emitted modules.
      noCheck: true,
    },
    include: [
      path.join(root, "electron/queue.ts"),
      path.join(root, "src/controller/queue/status-display.tsx"),
    ],
  }),
);
const tsc = path.join(
  path.dirname(require.resolve("typescript/package.json")),
  "bin/tsc",
);
execFileSync(process.execPath, [tsc, "-p", config], {
  cwd: root,
  stdio: "pipe",
});

function loadModule(file, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    readFileSync(path.join(temporary, file), "utf8"),
    {
      exports,
      AbortController,
      require: (name) =>
        Object.hasOwn(mocks, name) ? mocks[name] : require(name),
      ...globals,
    },
    { filename: file },
  );
  return exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const progress = () => ({ percent: 0, total: 0, processed: 0 });
function downloadJob(type, id) {
  return {
    id,
    type,
    status: "queued",
    progress: progress(),
    url: "sm9",
    path: id,
    format: { type: "dms", format: ["video", "audio"] },
  };
}
function convertJob(id, dependencies = []) {
  return {
    id,
    type: "convert",
    status: "queued",
    progress: progress(),
    comment: { type: "local", path: "comments.json", format: "formatted" },
    movie: { type: "local", path: "movie.mp4", duration: 1 },
    output: { path: `${id}.mp4` },
    option: { fps: 30, ss: 0 },
    wait: dependencies.map((job) => job.id),
  };
}

function harness() {
  const downloads = { movie: [], comment: [] };
  const conversions = [];
  const interrupted = [];
  const messages = [];
  const snapshots = [];
  const sessionModule = loadModule("electron/conversion-session.js", {
    "./converter": {
      createConverter: (job) => {
        const task = deferred();
        const inputStream = new Writable({ write: (_, __, done) => done() });
        conversions.push({ job, ...task });
        return {
          inputStream,
          run: () => task.promise,
          stop: () => interrupted.push("convert"),
        };
      },
    },
  });
  let rendererId = 0;
  const queue = loadModule("electron/queue.js", {
    "../src/util/frame-timing": loadModule("src/util/frame-timing.js", {}),
    "./controller-window": {
      sendMessageToController: (message) => {
        if (message.type === "progress") {
          snapshots.push(
            message.data.map(({ id, status }) => ({ id, status })),
          );
        } else messages.push(message);
      },
    },
    "./conversion-session": sessionModule,
    "./lib/json": { encodeError: String },
    "./lib/log": { getLogger: () => ({ error: () => {} }) },
    "./lib/niconico": {
      download: (_url, _format, _path, _progress, signal) => {
        const task = deferred();
        signal.addEventListener("abort", () => interrupted.push("movie"));
        downloads.movie.push(task);
        return task.promise;
      },
      downloadComment: (_job, _progress, signal) => {
        const task = deferred();
        signal.addEventListener("abort", () => interrupted.push("comment"));
        downloads.comment.push(task);
        return task.promise;
      },
    },
    "./renderer-window": {
      closeRendererWindow: (renderer) => renderer.destroy(),
      createRendererWindow: () => ({
        webContents: { id: ++rendererId },
        isDestroyed: () => false,
        destroy: () => {},
      }),
      sendMessageToRenderer: () => {},
    },
  });
  return { ...queue, downloads, conversions, interrupted, messages, snapshots };
}

test("a waiting head does not block ready conversions, which stay serial and FIFO", async () => {
  const h = harness();
  const dependency = downloadJob("movie", "download");
  const waiting = convertJob("waiting", [dependency]);
  const first = convertJob("first");
  const second = convertJob("second");
  h.appendQueue(dependency);
  h.appendQueue(waiting);
  h.appendQueue(first);
  h.appendQueue(second);
  assert.equal(waiting.status, "queued");
  assert.deepEqual(
    h.conversions.map(({ job }) => job.id),
    ["first"],
  );
  h.downloads.movie[0].resolve();
  await flush();
  assert.equal(dependency.status, "completed");
  assert.equal(waiting.status, "queued");
  h.conversions[0].resolve();
  await flush();
  assert.deepEqual(
    h.conversions.map(({ job }) => job.id),
    ["first", "waiting"],
  );
  h.conversions[1].resolve();
  await flush();
  assert.deepEqual(
    h.conversions.map(({ job }) => job.id),
    ["first", "waiting", "second"],
  );
});

for (const type of ["movie", "comment"]) {
  test(`${type} failure propagates while another conversion is active`, async () => {
    const h = harness();
    const dependency = downloadJob(type, "download");
    const waiting = convertJob("waiting", [dependency]);
    const ready = convertJob("ready");
    const next = convertJob("next");
    for (const job of [dependency, waiting, ready, next]) h.appendQueue(job);
    h.downloads[type][0].reject(new Error("download failed"));
    await flush();
    assert.equal(dependency.status, "fail");
    assert.equal(waiting.status, "fail");
    assert.equal(h.conversions.length, 1);
    assert.equal(h.conversions[0].job, ready);
    assert.ok(
      h.snapshots
        .at(-1)
        .some((job) => job.id === waiting.id && job.status === "fail"),
    );
    h.conversions[0].resolve();
    await flush();
    assert.equal(h.conversions[1].job, next);
  });

  for (const outcome of ["resolve", "reject"]) {
    test(`interrupting ${type} propagates immediately and survives ${outcome}`, async () => {
      const h = harness();
      const dependency = downloadJob(type, "download");
      const waiting = convertJob("waiting", [dependency]);
      h.appendQueue(dependency);
      h.appendQueue(waiting);
      h.processOnInterrupt(dependency.id);
      assert.equal(dependency.status, "interrupted");
      assert.equal(waiting.status, "interrupted");
      assert.deepEqual(h.interrupted, [type]);
      h.downloads[type][0][outcome](new Error("cancelled"));
      await flush();
      assert.equal(dependency.status, "interrupted");
      assert.equal(waiting.status, "interrupted");
      assert.equal(h.messages.length, 0);
      const ready = convertJob("ready");
      h.appendQueue(ready);
      assert.equal(h.conversions[0].job, ready);
    });
  }

  test(`queued ${type} can be cancelled without interrupting the active download`, async () => {
    const h = harness();
    const active = downloadJob(type, "active");
    const queued = downloadJob(type, "queued");
    const waiting = convertJob("waiting", [queued]);
    for (const job of [active, queued, waiting]) h.appendQueue(job);
    h.processOnInterrupt(queued.id);
    assert.equal(queued.status, "interrupted");
    assert.equal(waiting.status, "interrupted");
    assert.equal(active.status, "processing");
    assert.deepEqual(h.interrupted, []);
    h.downloads[type][0].resolve();
    await flush();
    assert.equal(h.downloads[type].length, 1);
  });
}

test("a failed dependency is propagated even when another dependency is still pending", async () => {
  const h = harness();
  const pending = downloadJob("movie", "pending");
  const failed = downloadJob("comment", "failed");
  const waiting = convertJob("waiting", [pending, failed]);
  for (const job of [pending, failed, waiting]) h.appendQueue(job);
  h.downloads.comment[0].reject(new Error("failed"));
  await flush();
  assert.equal(pending.status, "processing");
  assert.equal(waiting.status, "fail");
});

test("conversion starts only after all dependencies complete", async () => {
  const h = harness();
  const movie = downloadJob("movie", "movie");
  const comment = downloadJob("comment", "comment");
  const waiting = convertJob("waiting", [movie, comment]);
  for (const job of [movie, comment, waiting]) h.appendQueue(job);
  h.downloads.movie[0].resolve();
  await flush();
  assert.equal(waiting.status, "queued");
  assert.equal(h.conversions.length, 0);
  h.downloads.comment[0].resolve();
  await flush();
  assert.equal(waiting.status, "processing");
  assert.equal(h.conversions[0].job, waiting);
});

test("dependency failure propagates through reverse-ordered chains", async () => {
  const h = harness();
  const download = downloadJob("movie", "download");
  const parent = convertJob("parent", [download]);
  const child = convertJob("child", [parent]);
  for (const job of [download, child, parent]) h.appendQueue(job);
  h.downloads.movie[0].reject(new Error("failed"));
  await flush();
  assert.equal(parent.status, "fail");
  assert.equal(child.status, "fail");
  assert.equal(h.conversions.length, 0);
});

test("queued conversion cancellation preserves its downloads and never starts the conversion", async () => {
  const h = harness();
  const dependency = downloadJob("movie", "download");
  const waiting = convertJob("waiting", [dependency]);
  waiting.movie = { type: "remote", ref: dependency, duration: 1 };
  h.appendQueue(waiting);
  h.processOnInterrupt(waiting.id);
  assert.equal(waiting.status, "interrupted");
  assert.equal(dependency.status, "processing");
  assert.deepEqual(h.interrupted, []);
  h.downloads.movie[0].resolve();
  await flush();
  assert.equal(h.conversions.length, 0);
  assert.ok(
    h.snapshots.some((snapshot) =>
      snapshot.some(
        (job) => job.id === waiting.id && job.status === "interrupted",
      ),
    ),
  );
});

test("cancellation waits for the active converter to settle before starting the next one", async () => {
  const h = harness();
  const active = convertJob("active");
  const dependent = convertJob("dependent", [active]);
  const cancelled = convertJob("cancelled");
  const next = convertJob("next");
  for (const job of [active, dependent, cancelled, next]) h.appendQueue(job);
  h.processOnInterrupt(active.id);
  assert.equal(active.status, "processing");
  assert.equal(h.isConversionProcessing(), true);
  assert.equal(dependent.status, "interrupted");
  h.processOnInterrupt(cancelled.id);
  await flush();
  assert.deepEqual(h.interrupted, ["convert"]);
  assert.equal(h.conversions.length, 1);
  h.conversions[0].reject(new Error("cancelled"));
  await flush();
  assert.equal(active.status, "interrupted");
  assert.equal(cancelled.status, "interrupted");
  assert.equal(h.messages.length, 0);
  assert.equal(h.conversions[1].job, next);
});

test("unknown and terminal jobs ignore cancellation", async () => {
  const h = harness();
  const completed = convertJob("completed");
  h.appendQueue(completed);
  h.conversions[0].resolve();
  await flush();
  h.processOnInterrupt("unknown");
  h.processOnInterrupt(completed.id);
  assert.equal(completed.status, "completed");
  assert.deepEqual(h.interrupted, []);
});

const MockComponent = () => null;

test("queued and active rows expose a working cancel button; terminal rows do not", () => {
  const requests = [];
  const button = () => {};
  const { StatusDisplay } = loadModule(
    "src/controller/queue/status-display.js",
    {
      "@mui/icons-material": { StopOutlined: MockComponent },
      "@mui/material": { IconButton: button },
      "@/controller/queue/convert-item.module.scss": {},
      "@/controller/queue/progress-display": { ProgressDisplay: MockComponent },
    },
    { window: { api: { request: (request) => requests.push(request) } } },
  );
  function findButton(element) {
    if (!element || typeof element !== "object") return undefined;
    if (element.type === button) return element;
    return [element.props?.children].flat().map(findButton).find(Boolean);
  }
  for (const status of [
    "queued",
    "processing",
    "completed",
    "fail",
    "interrupted",
  ]) {
    const queue = { ...convertJob(status), status };
    const cancel = findButton(StatusDisplay({ queue }));
    assert.equal(
      Boolean(cancel),
      status === "queued" || status === "processing",
    );
    if (cancel) {
      cancel.props.onClick();
      assert.equal(requests.at(-1).queueId, queue.id);
      assert.equal(requests.at(-1).type, "interruptQueue");
    }
  }
});
