const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const temporary = mkdtempSync(path.join(tmpdir(), "conversion-form-"));
after(() => rmSync(temporary, { recursive: true, force: true }));
const config = path.join(temporary, "tsconfig.json");
writeFileSync(
  config,
  JSON.stringify({
    extends: path.join(root, "electron/tsconfig.json"),
    compilerOptions: { outDir: temporary, jsx: "react-jsx", noCheck: true },
    include: [path.join(root, "src/controller/convert/convert.tsx")],
  }),
);
execFileSync(
  process.execPath,
  [
    path.join(
      path.dirname(require.resolve("typescript/package.json")),
      "bin/tsc",
    ),
    "-p",
    config,
  ],
  { cwd: root, stdio: "pipe" },
);

function harness({
  clip = { start: "", end: "" },
  fps = 30,
  accepted = true,
  fail = false,
} = {}) {
  const states = [
    { type: "local", path: "movie.mp4", duration: 10 },
    { type: "local", path: "comments.json", format: "formatted" },
    clip,
  ];
  let cursor = 0;
  const messages = [],
    loading = [],
    requests = [];
  const atoms = { isLoadingAtom: {}, messageAtom: {} };
  const component = () => null;
  const conversionAtoms = {};
  vm.runInNewContext(
    readFileSync(
      path.join(temporary, "src/controller/convert/atoms.js"),
      "utf8",
    ),
    { exports: conversionAtoms, require },
  );
  const mockState = (initial) => {
    const index = cursor++;
    if (!Object.hasOwn(states, index)) states[index] = initial;
    if (index === 3 && states[index].video.fps === 30)
      states[index] = {
        ...states[index],
        video: { ...states[index].video, fps },
      };
    return [
      states[index],
      (value) => {
        states[index] =
          typeof value === "function" ? value(states[index]) : value;
      },
    ];
  };
  const mocks = {
    "@mui/material": new Proxy({}, { get: () => component }),
    "@mui/material/Button": { default: component },
    "@mui/material/TextField": { default: component },
    "./atoms": conversionAtoms,
    jotai: {
      useAtom: (atom) => mockState(atom.init),
      useSetAtom: (atom) => (value) =>
        (atom === atoms.messageAtom ? messages : loading).push(value),
    },
    react: {
      useState: mockState,
      useCallback: (fn) => fn,
      useEffect: () => {},
      useRef: (current) => ({ current }),
    },
    "@/components/select-field": { SelectField: component },
    "@/controller/atoms": atoms,
    "@/controller/comment-picker": { CommentPicker: component },
    "@/controller/movie-picker": { MoviePicker: component },
    "@/domain/conversion": require("../build/src/domain/conversion"),
    "@/type-guard": {},
    "@/util/time": require("./helpers/load-typescript.cjs")(
      "src/util/time.ts",
      { "@/util/zerofill": {} },
    ),
    "@/util/uuid": { uuid: () => "job" },
    "./convert.module.scss": {},
  };
  const exports = {};
  vm.runInNewContext(
    readFileSync(
      path.join(temporary, "src/controller/convert/convert.js"),
      "utf8",
    ),
    {
      exports,
      require: (name) =>
        Object.hasOwn(mocks, name) ? mocks[name] : require(name),
      window: {
        api: {
          request: async (request) => {
            requests.push(request);
            if (fail) throw new Error("IPC failed");
            return request.type === "selectOutput" ? "/output.mp4" : accepted;
          },
        },
      },
    },
  );
  function find(element, predicate) {
    if (!element || typeof element !== "object") return undefined;
    if (predicate(element)) return element;
    return [element.props?.children]
      .flat()
      .map((child) => find(child, predicate))
      .find(Boolean);
  }
  const render = () => {
    cursor = 0;
    return exports.Convert();
  };
  const convert = () =>
    find(
      render(),
      (element) => element.props?.children === "変換",
    ).props.onClick();
  return { states, messages, loading, requests, render, convert, find };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

for (const input of [
  { fps: 0 },
  { fps: NaN },
  { clip: { start: "3", end: "2" } },
  { clip: { start: "bad", end: "" } },
]) {
  test(`invalid form input is reported before choosing an output: ${JSON.stringify(input)}`, () => {
    const h = harness(input);
    h.convert();
    assert.equal(h.requests.length, 0);
    assert.equal(h.messages.length, 1);
    assert.ok(h.states[0]);
    assert.ok(h.states[1]);
  });
}

test("invalid clip text survives blur and cannot silently become an omitted boundary", () => {
  const h = harness({ clip: { start: "bad", end: "" } });
  const startField = h.find(
    h.render(),
    (element) => element.props?.label === "開始位置",
  );
  startField.props.onBlur({ target: { value: "bad" } });
  assert.equal(h.states[2].start, "bad");
  h.convert();
  assert.equal(h.requests.length, 0);
});

for (const accepted of [false, true]) {
  test(`current clip text is validated without blur; selection clears only on admission (${accepted})`, async () => {
    const h = harness({ clip: { start: "0", end: "5" }, fps: 29.97, accepted });
    h.convert();
    await flush();
    assert.deepEqual(
      h.requests.map(({ type }) => type),
      ["selectOutput", "appendQueue"],
    );
    assert.equal(h.requests[1].data.option.ss, 0);
    assert.equal(h.requests[1].data.option.to, 5);
    assert.equal(h.requests[1].data.option.fps, 29.97);
    assert.equal(h.states[0] === undefined, accepted);
    assert.equal(h.states[1] === undefined, accepted);
    assert.deepEqual(h.loading, [true, false]);
  });
}

test("IPC failure clears the loading state and preserves selected inputs", async () => {
  const h = harness({ fail: true });
  h.convert();
  await flush();
  assert.deepEqual(h.loading, [true, false]);
  assert.ok(h.states[0]);
  assert.ok(h.states[1]);
  assert.equal(h.messages.length, 1);
});
