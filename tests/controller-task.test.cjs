const assert = require("node:assert/strict");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");

test("a rejected controller request releases loading and preserves unfinished work", async () => {
  const errors = [];
  const { runControllerTask } = load("src/controller/task.ts", {
    "@/util/log": {
      getLogger: () => ({ error: (...args) => errors.push(args) }),
    },
  });
  for (const operation of [
    "metadata",
    "selectOutput",
    "selectFile",
    "appendQueue",
    "getSetting",
    "setSetting",
  ]) {
    let loading = true;
    let draft = "user input";
    const error = new Error(`${operation} failed`);
    await runControllerTask(
      async () => {
        await Promise.reject(error);
        draft = undefined;
      },
      (value) => {
        loading = value;
      },
    );
    assert.equal(loading, false);
    assert.equal(draft, "user input");
    assert.equal(errors.at(-1)[1], error);
  }
});

test("controller loading stays active until the action settles", async () => {
  const { runControllerTask } = load("src/controller/task.ts", {
    "@/util/log": { getLogger: () => ({ error() {} }) },
  });
  let finish;
  let loading = true;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const task = runControllerTask(
    () => pending,
    (value) => {
      loading = value;
    },
  );
  assert.equal(loading, true);
  finish();
  await task;
  assert.equal(loading, false);
});
