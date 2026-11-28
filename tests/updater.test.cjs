const assert = require("node:assert/strict");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");

const setup = ({ isPackaged = true, setting = "unset", answer = 0 } = {}) => {
  const calls = { dialogs: [], fetches: [], opened: [], saved: [] };
  let current = setting;
  let release = { tag_name: "v9.9.9", html_url: "https://github.com/x/y" };
  const updater = load(
    "electron/updater.ts",
    {
      electron: {
        app: { isPackaged, getVersion: () => "0.0.34" },
        dialog: {
          showMessageBox: async (options) => {
            calls.dialogs.push(options);
            return { response: answer };
          },
        },
        net: {
          fetch: async (url) => {
            calls.fetches.push(url);
            return { ok: true, json: async () => release };
          },
        },
        shell: { openExternal: async (url) => calls.opened.push(url) },
      },
      "../src/domain/update.js": require("../build/src/domain/update"),
      "./lib/log.js": { getLogger: () => ({ error() {} }) },
      "./store.js": {
        store: {
          get: () => current,
          set: (_key, value) => {
            current = value;
            calls.saved.push(value);
          },
        },
      },
    },
    { process: { platform: "win32" } },
  );
  return {
    ...updater,
    calls,
    setRelease: (value) => (release = value),
    setCurrent: (value) => (current = value),
  };
};

test("first run asks for consent, saves the answer, and checks only when accepted", async () => {
  const yes = setup({ answer: 0 });
  await yes.initUpdateCheck();
  assert.deepEqual(yes.calls.saved, ["enabled"]);
  assert.equal(yes.calls.fetches.length, 1);
  assert.equal(yes.calls.dialogs.length, 2); // consent + update notice

  const no = setup({ answer: 1 });
  await no.initUpdateCheck();
  assert.deepEqual(no.calls.saved, ["disabled"]);
  assert.equal(no.calls.fetches.length, 0);
  assert.equal(no.calls.dialogs.length, 1);
});

test("later launches do not prompt and respect the saved choice", async () => {
  const disabled = setup({ setting: "disabled" });
  await disabled.initUpdateCheck();
  assert.equal(disabled.calls.dialogs.length, 0);
  assert.equal(disabled.calls.fetches.length, 0);

  const enabled = setup({ setting: "enabled", answer: 0 });
  await enabled.initUpdateCheck();
  assert.equal(enabled.calls.dialogs.length, 1); // update notice only
  assert.deepEqual(enabled.calls.opened, ["https://github.com/x/y"]);
});

test("unpackaged builds never prompt or touch the network", async () => {
  const dev = setup({ isPackaged: false });
  await dev.initUpdateCheck();
  dev.onUpdateCheckSettingChanged();
  assert.equal(dev.calls.dialogs.length, 0);
  assert.equal(dev.calls.fetches.length, 0);
});

test("no notice when up to date, and a pending check is dropped if turned off", async () => {
  const same = setup({ setting: "enabled" });
  same.setRelease({ tag_name: "v0.0.34", html_url: "https://github.com/x/y" });
  await same.initUpdateCheck();
  assert.equal(same.calls.dialogs.length, 0);

  const off = setup({ setting: "enabled" });
  off.setCurrent("enabled");
  const pending = off.initUpdateCheck();
  off.setCurrent("disabled");
  await pending;
  assert.equal(off.calls.dialogs.length, 0);
});
