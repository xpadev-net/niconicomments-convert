const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const vm = require("node:vm");
const load = require("./helpers/load-typescript.cjs");

const temporary = mkdtempSync(path.join(tmpdir(), "download-picker-"));
after(() => rmSync(temporary, { recursive: true, force: true }));
const root = path.resolve(__dirname, "..");
const config = path.join(temporary, "tsconfig.json");
writeFileSync(
  config,
  JSON.stringify({
    extends: path.join(root, "electron/tsconfig.json"),
    compilerOptions: {
      outDir: temporary,
      module: "CommonJS",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      noCheck: true,
    },
    include: ["comment", "movie"].map((type) =>
      path.join(root, `src/controller/${type}/${type}.tsx`),
    ),
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

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

// Execute each real TSX component and its onChange handler. Retain hook state
// between renders so the actual picker key reveals whether it would remount.
const harness = (type) => {
  const title = type === "comment" ? "Comment" : "Movie";
  const pickerName = `Remote${title}Picker`;
  const picker = () => null;
  const requests = [];
  const errors = [];
  let loading = true;
  let key = 0;
  const task = load("src/controller/task.ts", {
    "@/util/log": {
      getLogger: () => ({ error: (...args) => errors.push(args) }),
    },
  });
  const exports = {};
  const mocks = {
    react: {
      useState: () => [
        key,
        (update) => {
          key = update(key);
        },
      ],
    },
    jotai: {
      useSetAtom: () => (value) => {
        loading = value;
      },
    },
    "@/controller/atoms": {},
    [`@/controller/${type}-picker/remote/remote-${type}-picker`]: {
      [pickerName]: picker,
    },
    "@/controller/task": task,
    "./movie.module.scss": { default: {} },
  };
  vm.runInNewContext(
    readFileSync(
      path.join(temporary, `src/controller/${type}/${type}.js`),
      "utf8",
    ),
    {
      exports,
      require: (name) =>
        Object.hasOwn(mocks, name) ? mocks[name] : require(name),
      window: {
        api: {
          request: (request) => {
            const pending = deferred();
            requests.push({ request, ...pending });
            return pending.promise;
          },
        },
      },
    },
  );
  const render = () => {
    const element = exports[title]({});
    return type === "comment" ? element : element.props.children;
  };
  return {
    render,
    requests,
    errors,
    get loading() {
      return loading;
    },
  };
};

for (const type of ["comment", "movie"]) {
  test(`${type} download retains the picker after rejection and resets only after a successful retry`, async () => {
    const h = harness(type);
    const original = h.render();
    const ref = {
      type,
      option: { type: "custom", end: { type: "count", count: 0 } },
    };
    original.props.onChange({ type: "remote", ref });
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].request.type, "appendQueue");
    assert.equal(h.requests[0].request.data, ref);
    assert.equal(
      h.render().key,
      original.key,
      "pending submission must not remount the picker",
    );
    const error = new Error("Invalid IPC request");
    h.requests[0].reject(error);
    await flush();
    assert.equal(
      h.render().key,
      original.key,
      "rejected submission must preserve the picker and its input",
    );
    assert.equal(h.loading, false);
    assert.equal(h.errors.at(-1)[1], error);

    const corrected = {
      ...ref,
      option: { type: "custom", end: { type: "count", count: 1000 } },
    };
    h.render().props.onChange({ type: "remote", ref: corrected });
    assert.equal(h.requests[1].request.data, corrected);
    assert.equal(h.render().key, original.key);
    h.requests[1].resolve(true);
    await flush();
    assert.notEqual(
      h.render().key,
      original.key,
      "successful submission must reset the picker",
    );
    assert.equal(h.loading, false);
  });

  test(`${type} download ignores an empty selection without resetting the picker`, async () => {
    const h = harness(type);
    const original = h.render();
    original.props.onChange(undefined);
    await flush();
    assert.equal(h.requests.length, 0);
    assert.equal(h.render().key, original.key);
    assert.equal(h.loading, false);
  });
}
