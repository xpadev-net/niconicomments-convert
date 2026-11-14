const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { createRequire, Module } = require("node:module");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { PassThrough } = require("node:stream");
const { test } = require("node:test");
const { spawn, ProcessError } = require("../build/electron/lib/spawn.js");

// Stub only application dependencies; exercise the compiled production code.
function loadWithMocks(filename, mocks) {
  const path = resolve(filename);
  const module = new Module(path);
  const realRequire = createRequire(path);
  module.require = (name) => (name in mocks ? mocks[name] : realRequire(name));
  module._compile(readFileSync(path, "utf8"), path);
  return module.exports;
}

function fakeExecution(onData) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 12345;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => true;
  const runner = loadWithMocks("build/electron/lib/spawn.js", {
    "node:child_process": { spawn: () => child },
  });
  return { child, ...runner.spawn("fake-command", [], {}, onData) };
}

const processTest = (name, fn) => test(name, { timeout: 10000 }, fn);

processTest(
  "a missing executable rejects with the original ENOENT error",
  async () => {
    const execution = spawn(
      join(tmpdir(), "missing-command-process-runner", "binary"),
    );
    const closed = new Promise((resolve) =>
      execution.process.once("close", resolve),
    );
    await assert.rejects(execution.promise, (error) => {
      assert.ok(error instanceof ProcessError);
      assert.equal(error.cause.code, "ENOENT");
      assert.equal(error.code, null);
      assert.equal(error.cancelled, false);
      assert.equal(error.stdout, "");
      return true;
    });
    await closed;
  },
);

test("an executable without permission rejects with EACCES", {
  skip: process.platform === "win32",
  timeout: 10000,
}, async () => {
  const dir = mkdtempSync(join(tmpdir(), "process-runner-"));
  try {
    const path = join(dir, "binary");
    writeFileSync(path, "#!/bin/sh\nexit 0\n");
    chmodSync(path, 0o644);
    await assert.rejects(
      spawn(path).promise,
      (error) => error.cause.code === "EACCES",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

processTest(
  "synchronous spawn failures also reject the returned promise",
  async () => {
    const execution = spawn("");
    assert.equal(execution.process, undefined);
    await assert.rejects(
      execution.promise,
      (error) => error.cause.code === "ERR_INVALID_ARG_VALUE",
    );
  },
);

processTest(
  "exit does not settle before late stdout and stderr have closed",
  async () => {
    const { child, promise } = fakeExecution();
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    child.emit("exit", 0, null);
    await Promise.resolve();
    assert.equal(settled, false);
    child.stdout.write("final stdout");
    child.stderr.write("final stderr");
    child.emit("close", 0, null);
    const result = await promise;
    assert.equal(result.stdout, "final stdout");
    assert.equal(result.stderr, "final stderr");
    assert.equal(result.code, 0);
  },
);

processTest("error followed by close preserves the failure", async () => {
  const { child, promise } = fakeExecution();
  const cause = new Error("cannot start");
  child.emit("error", cause);
  child.emit("close", 0, null);
  await assert.rejects(promise, (error) => error.cause === cause);
});

processTest(
  "a nonzero exit preserves all output and its exit code",
  async () => {
    await assert.rejects(
      spawn(process.execPath, [
        "-e",
        `
    process.stdout.write('stdout');
    process.stderr.write('stderr');
    process.exitCode = 7;
  `,
      ]).promise,
      (error) => {
        assert.equal(error.code, 7);
        assert.equal(error.stdout, "stdout");
        assert.equal(error.stderr, "stderr");
        assert.equal(error.cancelled, false);
        return true;
      },
    );
  },
);

processTest("real pipes are drained completely before resolving", async () => {
  const size = 512 * 1024;
  const result = await spawn(process.execPath, [
    "-e",
    `
    process.stdout.write('x'.repeat(${size}) + 'last-stdout');
    process.stderr.write('y'.repeat(${size}) + 'last-stderr');
  `,
  ]).promise;
  assert.equal(result.stdout, `${"x".repeat(size)}last-stdout`);
  assert.equal(result.stderr, `${"y".repeat(size)}last-stderr`);
  assert.equal(result.stdoutTruncated, false);
  assert.equal(result.stderrTruncated, false);
});

processTest(
  "retention is bounded while callbacks receive the complete output",
  async () => {
    let stdout = "";
    let stderr = "";
    const result = await spawn(
      process.execPath,
      [
        "-e",
        `
    process.stdout.write('x'.repeat(100000) + 'final-out');
    process.stderr.write('y'.repeat(100000) + 'final-err');
  `,
      ],
      { maxOutputBytes: 32 },
      (data) => {
        stdout += data;
      },
      (data) => {
        stderr += data;
      },
    ).promise;
    assert.equal(result.stdout, `${"x".repeat(23)}final-out`);
    assert.equal(result.stderr, `${"y".repeat(23)}final-err`);
    assert.equal(result.stdoutTruncated, true);
    assert.equal(result.stderrTruncated, true);
    assert.equal(stdout.length, 100009);
    assert.equal(stderr.length, 100009);
  },
);

processTest("the default retention limit is one MiB per stream", async () => {
  const result = await spawn(process.execPath, [
    "-e",
    `
    process.stdout.write('x'.repeat(2 * 1024 * 1024));
    process.stderr.write('y'.repeat(2 * 1024 * 1024));
  `,
  ]).promise;
  assert.equal(result.stdout.length, 1024 * 1024);
  assert.equal(result.stderr.length, 1024 * 1024);
  assert.equal(result.stdoutTruncated, true);
  assert.equal(result.stderrTruncated, true);
});

processTest("zero retention and ignored stdio are supported", async () => {
  const result = await spawn(
    process.execPath,
    ["-e", "console.log('output')"],
    { maxOutputBytes: 0 },
  ).promise;
  assert.equal(result.stdout, "");
  assert.equal(result.stdoutTruncated, true);
  const ignored = await spawn(
    process.execPath,
    ["-e", "console.log('ignored')"],
    { stdio: "ignore" },
  ).promise;
  assert.equal(ignored.stdout, "");
});

processTest(
  "split UTF-8 is decoded on both streams and tail boundaries stay valid",
  async () => {
    const { child, promise } = fakeExecution();
    const bytes = Buffer.from("あいう");
    for (const byte of bytes) {
      child.stdout.write(Buffer.from([byte]));
      child.stderr.write(Buffer.from([byte]));
    }
    child.emit("close", 0, null);
    const result = await promise;
    assert.equal(result.stdout, "あいう");
    assert.equal(result.stderr, "あいう");
    const tail = await spawn(
      process.execPath,
      ["-e", "process.stdout.write('あいう')"],
      { maxOutputBytes: 4 },
    ).promise;
    assert.equal(tail.stdout, "う");
    assert.equal(tail.stdoutTruncated, true);
  },
);

processTest("a pre-aborted signal prevents process creation", async () => {
  const controller = new AbortController();
  controller.abort();
  const execution = spawn(process.execPath, [], { signal: controller.signal });
  assert.equal(execution.process, undefined);
  await assert.rejects(execution.promise, {
    name: "AbortError",
    cancelled: true,
  });
});

processTest(
  "stop is idempotent and cancellation rejects even if the child exits zero",
  async () => {
    const { child, promise, stop } = fakeExecution();
    const signals = [];
    child.kill = (signal) => {
      signals.push(signal);
      return true;
    };
    stop();
    stop();
    child.emit("close", 0, null);
    await assert.rejects(promise, {
      name: "AbortError",
      cancelled: true,
      code: 0,
    });
    stop();
    assert.deepEqual(signals, ["SIGINT"]);
  },
);

processTest("an abort signal cancels a running child", async () => {
  const controller = new AbortController();
  const execution = spawn(
    process.execPath,
    [
      "-e",
      `
    process.stdout.write('ready');
    setInterval(() => {}, 1000);
  `,
    ],
    { signal: controller.signal },
    () => {
      controller.abort();
    },
  );
  await assert.rejects(execution.promise, {
    name: "AbortError",
    cancelled: true,
  });
  assert.notEqual(execution.process.pid, undefined);
});

test("a child ignoring SIGINT is terminated after the grace period", {
  skip: process.platform === "win32",
  timeout: 10000,
}, async () => {
  const execution = spawn(
    process.execPath,
    [
      "-e",
      `
    process.on('SIGINT', () => {});
    process.stdout.write('ready');
    setInterval(() => {}, 1000);
  `,
    ],
    { killTimeoutMs: 30 },
    () => {
      execution.stop();
    },
  );
  await assert.rejects(execution.promise, {
    cancelled: true,
    signal: "SIGKILL",
  });
});

test("unexpected signal termination is a failure", {
  skip: process.platform === "win32",
  timeout: 10000,
}, async () => {
  await assert.rejects(
    spawn(process.execPath, ["-e", "process.kill(process.pid, 'SIGTERM')"])
      .promise,
    { code: null, signal: "SIGTERM", cancelled: false },
  );
});

processTest("explicit success codes are honored", async () => {
  const result = await spawn(
    process.execPath,
    ["-e", "process.exitCode = 255"],
    { successCodes: [0, 255] },
  ).promise;
  assert.equal(result.code, 255);
});

processTest(
  "output callback failures reject and terminate the child",
  async () => {
    const cause = new Error("callback failed");
    const execution = spawn(
      process.execPath,
      ["-e", "console.log('ready'); setInterval(() => {}, 1000)"],
      {},
      () => {
        throw cause;
      },
    );
    const closed = once(execution.process, "close");
    await assert.rejects(execution.promise, (error) => error.cause === cause);
    await closed;
  },
);

processTest(
  "invalid retention settings reject without starting a child",
  async () => {
    for (const maxOutputBytes of [-1, NaN, Infinity, 1.5]) {
      const execution = spawn(process.execPath, [], { maxOutputBytes });
      assert.equal(execution.process, undefined);
      await assert.rejects(
        execution.promise,
        (error) => error.cause instanceof RangeError,
      );
    }
  },
);

function loadConverter(binary) {
  return loadWithMocks("build/electron/ffmpeg-stream/stream.js", {
    "../assets": { ffmpegPath: binary },
    "../lib/log": { getLogger: () => ({ debug() {}, log() {}, error() {} }) },
  }).Converter;
}

processTest(
  "Converter propagates executable startup failure through the common runner",
  async () => {
    const Converter = loadConverter(
      join(tmpdir(), "missing-converter-process-runner", "binary"),
    );
    await assert.rejects(new Converter().run(), (error) => {
      assert.ok(error instanceof ProcessError);
      assert.equal(error.cause.code, "ENOENT");
      return true;
    });
  },
);

processTest("Converter cancellation before run prevents spawning", async () => {
  const Converter = loadConverter(process.execPath);
  const converter = new Converter();
  converter.stop();
  converter.stop();
  await assert.rejects(converter.run(), {
    name: "AbortError",
    cancelled: true,
  });
});

function loadScriptConverter(script, onLog = () => {}) {
  return loadWithMocks("build/electron/ffmpeg-stream/stream.js", {
    "../assets": { ffmpegPath: "fake-ffmpeg" },
    "../lib/log": { getLogger: () => ({ debug() {}, log: onLog, error() {} }) },
    "../lib/spawn": {
      spawn: (_command, _args, options, ...callbacks) =>
        spawn(process.execPath, ["-e", script], options, ...callbacks),
    },
  }).Converter;
}

processTest(
  "Converter drains its extra output pipes before completing",
  async () => {
    const Converter = loadScriptConverter(`
    const stream = require('node:fs').createWriteStream(null, { fd: 3 });
    stream.end('x'.repeat(128 * 1024) + 'last-frame');
  `);
    const converter = new Converter();
    const stream = converter.createOutputStream({});
    let output = "";
    stream.on("data", (data) => {
      output += data;
    });
    const ended = once(stream, "end");
    await converter.run();
    await ended;
    assert.equal(output, `${"x".repeat(128 * 1024)}last-frame`);
  },
);

processTest("Converter accepts ffmpeg's existing exit code 255", async () => {
  const Converter = loadScriptConverter("process.exitCode = 255");
  await new Converter().run();
});

processTest("Converter reports active cancellation as a failure", async () => {
  const Converter = loadScriptConverter(`
    require('node:fs').writeSync(3, 'ready');
    setInterval(() => {}, 1000);
  `);
  const converter = new Converter();
  converter.createOutputStream({}).on("data", () => {
    converter.stop();
  });
  await assert.rejects(converter.run(), {
    name: "AbortError",
    cancelled: true,
  });
});

function loadConversionQueue(Converter) {
  const messages = [];
  const rendererMessages = [];
  const finished = Promise.withResolvers();
  let conversionSettled = false;
  const converter = loadWithMocks("build/electron/converter.js", {
    "./ffmpeg-stream/stream": { Converter },
    "./store": { store: { get: () => undefined } },
  });
  const backends = [];
  const createConverter = converter.createConverter;
  converter.createConverter = (...args) => {
    const backend = createConverter(...args);
    backends.push(backend);
    const run = backend.run;
    backend.run = async () => {
      try {
        await run();
      } finally {
        conversionSettled = true;
      }
    };
    return backend;
  };
  const { ConversionSession } = loadWithMocks(
    "build/electron/conversion-session.js",
    {
      "./converter": converter,
    },
  );
  let rendererId = 0;
  const queue = loadWithMocks("build/electron/queue.js", {
    "./conversion-session": { ConversionSession },
    "./controller-window": {
      sendMessageToController: (message) => {
        messages.push(structuredClone(message));
        if (
          message.type === "progress" &&
          conversionSettled &&
          message.data.some((item) =>
            ["completed", "interrupted", "fail"].includes(item.status),
          )
        ) {
          finished.resolve();
        }
      },
    },
    "./renderer-window": {
      closeRendererWindow: (renderer) => renderer.destroy(),
      createRendererWindow: () => ({
        webContents: { id: ++rendererId },
        destroyed: false,
        isDestroyed() {
          return this.destroyed;
        },
        destroy() {
          this.destroyed = true;
        },
      }),
      sendMessageToRenderer: (_renderer, message) => {
        rendererMessages.push(message);
      },
    },
    "./lib/log": { getLogger: () => ({ error() {} }) },
    "./lib/niconico": {},
    "./lib/niconico/dmc": {},
    "./lib/niconico/dms": {},
  });
  const job = {
    id: "conversion-under-test",
    type: "convert",
    status: "queued",
    progress: { percent: 0, processed: 0, total: 0 },
    movie: { type: "local", path: "input.mp4", duration: 1 },
    comment: { type: "local", path: "comments.json", format: "formatted" },
    output: { path: "output.mp4" },
    option: { fps: 30, width: 1920, height: 1080, options: {} },
  };
  return {
    ...queue,
    stop: () => {
      for (const backend of backends) backend.stop();
    },
    job,
    messages,
    rendererMessages,
    finished: finished.promise,
  };
}

processTest(
  "interrupting a queued conversion preserves interrupted without an error dialog",
  async (t) => {
    const ready = Promise.withResolvers();
    const Converter = loadScriptConverter(
      `
    process.stderr.write('header\\nready\\n');
    setInterval(() => {}, 1000);
  `,
      (_tag, line) => {
        if (line === "ready") ready.resolve();
      },
    );
    const queue = loadConversionQueue(Converter);
    t.after(() => queue.stop());
    queue.appendQueue(queue.job);
    await ready.promise;
    assert.equal(queue.job.status, "processing");
    queue.processOnInterrupt(queue.job.id);
    assert.equal(queue.job.status, "processing");
    await queue.finished;
    assert.equal(queue.job.status, "interrupted");
    assert.equal(
      queue.messages.filter((message) => message.type === "message").length,
      0,
    );
    assert.equal(queue.messages.at(-1).data[0].status, "interrupted");
    assert.ok(queue.rendererMessages.some((message) => message.type === "end"));
  },
);

for (const [name, createConverter] of [
  ["a nonzero process exit", () => loadScriptConverter("process.exitCode = 7")],
  [
    "a callback failure that also stops the child",
    () =>
      loadScriptConverter(
        `
      process.stderr.write('header\\nerror\\n');
      setInterval(() => {}, 1000);
    `,
        (_tag, line) => {
          if (line === "error") throw new Error("log callback failed");
        },
      ),
  ],
  [
    "an executable startup failure",
    () =>
      loadConverter(join(tmpdir(), "missing-queue-process-runner", "binary")),
  ],
]) {
  processTest(`the conversion queue reports ${name} as failure`, async () => {
    const queue = loadConversionQueue(createConverter());
    queue.appendQueue(queue.job);
    await queue.finished;
    assert.equal(queue.job.status, "fail");
    const errors = queue.messages.filter(
      (message) => message.type === "message",
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0].title, "書き出し中にエラーが発生しました");
  });
}

for (const failureType of ["callback", "stream", "process"]) {
  processTest(
    `${failureType} failures wait for close and preserve the first cause`,
    async () => {
      const cause = new Error(`${failureType} failed`);
      const { child, promise } = fakeExecution(() => {
        throw cause;
      });
      const signals = [];
      child.kill = (signal) => {
        signals.push(signal);
        return true;
      };
      let settled = false;
      void promise.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      if (failureType === "callback") child.stdout.write("trigger");
      else if (failureType === "stream") child.stdout.emit("error", cause);
      else child.emit("error", cause);
      await Promise.resolve();
      assert.equal(settled, false);
      assert.deepEqual(signals, ["SIGINT"]);
      child.emit("error", new Error("secondary failure"));
      child.stderr.write("final diagnostics");
      child.emit("exit", 0, null);
      await Promise.resolve();
      assert.equal(settled, false);
      child.emit("close", 0, null);
      await assert.rejects(promise, (error) => {
        assert.equal(error.cause, cause);
        assert.equal(error.message, cause.message);
        assert.equal(error.code, 0);
        assert.equal(error.stderr, "final diagnostics");
        assert.equal(error.cancelled, false);
        return true;
      });
    },
  );
}

test("a failed conversion closes its child before the next conversion starts", {
  skip: process.platform === "win32",
  timeout: 10000,
}, async (t) => {
  const cause = new Error("output callback failed");
  const executions = [];
  const secondStarted = Promise.withResolvers();
  const Converter = loadWithMocks("build/electron/ffmpeg-stream/stream.js", {
    "../assets": { ffmpegPath: "fake-ffmpeg" },
    "../lib/log": {
      getLogger: () => ({
        debug() {},
        error() {},
        log: (_tag, line) => {
          if (line === "trigger") throw cause;
        },
      }),
    },
    "../lib/spawn": {
      spawn: (_command, _args, options, ...callbacks) => {
        const first = executions.length === 0;
        const startsAfterFirstClose = first || executions[0].closed;
        const execution = spawn(
          process.execPath,
          [
            "-e",
            first
              ? `
          process.on('SIGINT', () => {});
          process.stderr.write('header\\ntrigger\\n');
          setInterval(() => process.stderr.write('still writing\\n'), 5);
        `
              : "process.exitCode = 0",
          ],
          { ...options, killTimeoutMs: 100 },
          ...callbacks,
        );
        const record = { ...execution, closed: false, startsAfterFirstClose };
        execution.process.once("close", () => {
          record.closed = true;
        });
        executions.push(record);
        if (!first) secondStarted.resolve();
        return execution;
      },
    },
  }).Converter;
  t.after(() => {
    for (const { process } of executions) process.kill("SIGKILL");
  });
  const queue = loadConversionQueue(Converter);
  const next = { ...structuredClone(queue.job), id: "next-conversion" };
  queue.appendQueue(queue.job);
  queue.appendQueue(next);
  await secondStarted.promise;
  assert.equal(executions[1].startsAfterFirstClose, true);
  assert.equal(executions[0].closed, true);
  await assert.rejects(executions[0].promise, (error) => {
    assert.equal(error.cause, cause);
    assert.equal(error.signal, "SIGKILL");
    assert.equal(error.cancelled, false);
    assert.match(error.stderr, /still writing/);
    return true;
  });
  await executions[1].promise;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queue.job.status, "fail");
  assert.equal(next.status, "completed");
  assert.equal(
    queue.messages.filter((message) => message.type === "message").length,
    1,
  );
});
