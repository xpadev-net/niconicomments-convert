const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { dirname, join } = require("node:path");
const { test } = require("node:test");

test("IPC request types enforce correlated payloads, responses, and handlers", () => {
  const compiler = join(
    dirname(require.resolve("typescript/package.json")),
    "bin",
    "tsc",
  );
  const result = spawnSync(
    process.execPath,
    [compiler, "-p", "tests/fixtures/tsconfig.json"],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(
    result.status,
    0,
    `${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
  );
});
