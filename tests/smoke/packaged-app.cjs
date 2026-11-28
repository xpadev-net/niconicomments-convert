// Run against an unpacked electron-builder artifact, never the development app.
const assert = require("node:assert/strict");
const { spawn, execFile } = require("node:child_process");
const { once } = require("node:events");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

async function smoke(executable) {
  const profile = mkdtempSync(join(tmpdir(), "niconicomments-smoke-"));
  // Skip the first-run update opt-in dialog, which would block startup.
  writeFileSync(
    join(profile, "config.json"),
    JSON.stringify({ updateCheck: "disabled" }),
  );
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const child = spawn(
    resolve(executable),
    [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "",
    exited = false,
    socket,
    timer;
  const closed = new Promise((resolve) => {
    child.once("error", (error) => {
      output += String(error);
    });
    child.once("close", (code, signal) => {
      exited = true;
      resolve({ code, signal });
    });
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      output = (output + chunk).slice(-32000);
    });
  }
  async function run() {
    // First launch may download FFmpeg/FFprobe through the real startup code.
    let target;
    while (!target) {
      assert.equal(exited, false, `app exited during startup\n${output}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
          signal: AbortSignal.timeout(2000),
        });
        const targets = await response.json();
        target = targets.find(
          ({ type, url }) =>
            type === "page" &&
            url.startsWith("file:") &&
            url.endsWith("/index.html"),
        );
      } catch {
        /* Wait for Chromium's debugger to start listening. */
      }
      if (!target) await delay(200);
    }
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await once(socket, "open");
    let nextId = 0;
    const pending = new Map(),
      exceptions = [];
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === "Runtime.exceptionThrown")
        exceptions.push(message.params);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error)
        request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const request of pending.values())
        request.reject(new Error("debugger disconnected"));
      pending.clear();
    });
    function command(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    await command("Runtime.enable");
    const result = await command("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        while (!document.querySelector('#root h2')) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (typeof window.api?.request !== 'function') throw new Error('preload API missing');
        await window.api.request({ host: 'controller', type: 'setSetting', key: 'showRendererWindow', data: false });
        const setting = await window.api.request({ host: 'controller', type: 'getSetting', key: 'showRendererWindow' });
        if (setting !== false) throw new Error('settings IPC failed');
        const queue = await new Promise(async (resolve, reject) => {
          const listener = (_event, message) => {
            if (message.type !== 'progress') return;
            window.api.remove(listener);
            resolve(message.data);
          };
          window.api.onResponse(listener);
          try { await window.api.request({ host: 'controller', type: 'getQueue' }); }
          catch (error) { window.api.remove(listener); reject(error); }
        });
        return { heading: document.querySelector('#root h2').textContent, queue };
      })()`,
    });
    assert.equal(
      result.exceptionDetails,
      undefined,
      JSON.stringify(result.exceptionDetails),
    );
    assert.equal(result.result.value.heading, "変換");
    assert.deepEqual(result.result.value.queue, []);
    assert.deepEqual(exceptions, []);
    // Verify normal window closure exits the application successfully.
    await command("Runtime.evaluate", {
      expression: "setTimeout(() => window.close(), 100)",
    });
    assert.deepEqual(await closed, { code: 0, signal: null });
    console.log(
      "Packaged app startup, UI, preload, settings/queue IPC and clean exit passed.",
    );
  }
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("packaged app startup timed out (120s)")),
          120000,
        );
      }),
    ]);
  } catch (error) {
    throw new Error(`${error.stack}\nApplication output:\n${output}`);
  } finally {
    clearTimeout(timer);
    socket?.close();
    if (!exited) {
      if (process.platform === "win32") {
        await new Promise((resolve) =>
          execFile(
            "taskkill",
            ["/PID", String(child.pid), "/T", "/F"],
            resolve,
          ),
        );
      } else child.kill("SIGKILL");
      await closed;
    }
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}

const executable = process.argv[2];
if (!executable)
  throw new Error("Usage: pnpm test:smoke <packaged executable>");
smoke(executable).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
