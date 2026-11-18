const assert = require("node:assert/strict");
const { test } = require("node:test");
const load = require("./helpers/load-typescript.cjs");
const settings = require("../build/src/domain/settings");
const validation = require("../build/src/domain/validation");
const { getDefaultSettings, migrateSettings, parseSetting, settingsVersion } =
  settings;

test("unversioned settings migrate without losing user choices and migration is idempotent", () => {
  const legacy = {
    auth: { type: "cookie", path: "/cookies.txt" },
    ffmpegOptions: { crf: 25, r: "{FPS}", an: "" },
    showRendererWindow: false,
    commentFileExt: ".xml",
  };
  const snapshot = structuredClone(legacy);
  const migrated = migrateSettings(legacy);
  assert.deepEqual(migrated, {
    ...legacy,
    settingsVersion,
    autoUpdate: "unset",
    ffmpegOptions: { crf: "25", r: "{FPS}", an: "" },
  });
  assert.deepEqual(migrateSettings(migrated), migrated);
  assert.deepEqual(legacy, snapshot);
});

test("missing or corrupt settings recover independently; false and empty options are valid", () => {
  const defaults = getDefaultSettings();
  for (const value of [undefined, null, [], "broken", {}]) {
    assert.deepEqual(migrateSettings(value), { ...defaults, settingsVersion });
  }
  assert.deepEqual(
    migrateSettings({
      auth: { type: "cookie", path: 123 },
      ffmpegOptions: { crf: { value: 30 } },
      showRendererWindow: false,
      commentFileExt: ".txt",
    }),
    {
      ...defaults,
      settingsVersion,
      showRendererWindow: false,
      commentFileExt: ".txt",
    },
  );
  assert.deepEqual(migrateSettings({ ffmpegOptions: {} }).ffmpegOptions, {});
  assert.equal(
    migrateSettings({ showRendererWindow: "false" }).showRendererWindow,
    true,
  );
});

test("auto update is opt-in: unset by default and invalid values fall back to unset", () => {
  assert.equal(getDefaultSettings().autoUpdate, "unset");
  assert.equal(migrateSettings({}).autoUpdate, "unset");
  assert.equal(migrateSettings({ autoUpdate: "yes" }).autoUpdate, "unset");
  assert.equal(
    migrateSettings({ autoUpdate: "enabled" }).autoUpdate,
    "enabled",
  );
});

test("current writes reject invalid types rather than coercing them", () => {
  for (const [key, value] of [
    ["auth", null],
    ["auth", { type: "unknown" }],
    ["auth", { type: "cookie", path: "" }],
    ["auth", { type: "browser", profile: { browser: "chrome" } }],
    ["showRendererWindow", "false"],
    ["showRendererWindow", 0],
    ["ffmpegOptions", []],
    ["ffmpegOptions", { crf: 30 }],
    ["ffmpegOptions", { an: null }],
    ["commentFileExt", "json"],
    ["autoUpdate", true],
    ["autoUpdate", "on"],
  ])
    assert.throws(() => parseSetting(key, value), validation.ValidationError);
  assert.deepEqual(parseSetting("ffmpegOptions", { an: "" }), { an: "" });
  for (const value of ["unset", "enabled", "disabled"])
    assert.equal(parseSetting("autoUpdate", value), value);
  assert.deepEqual(parseSetting("auth", { type: "browser" }), {
    type: "browser",
  });
});

test("browser profiles validate their discriminants and required fields", () => {
  const profiles = [
    {
      type: "chromiumProfile",
      browser: "chrome",
      profileName: "Default",
      name: "user",
      path: "/profile",
    },
    {
      type: "firefoxBasicProfile",
      browser: "firefox",
      name: "user",
      path: "/profile",
    },
    {
      type: "firefoxContainer",
      browser: "firefox",
      name: "user",
      path: "/profile",
      profileName: "default",
      containerName: "personal",
      contextId: 1,
    },
  ];
  for (const profile of profiles) {
    assert.deepEqual(parseSetting("auth", { type: "browser", profile }), {
      type: "browser",
      profile,
    });
    for (const broken of [
      { ...profile, path: 1 },
      { ...profile, type: "unknown" },
      { ...profile, browser: "unknown" },
    ]) {
      assert.throws(() =>
        parseSetting("auth", { type: "browser", profile: broken }),
      );
    }
  }
  assert.throws(() =>
    parseSetting("auth", {
      type: "browser",
      profile: { ...profiles[2], contextId: -1 },
    }),
  );
});

test("versioned files use the current schema and future versions are never overwritten", () => {
  assert.deepEqual(
    migrateSettings({ settingsVersion, ffmpegOptions: { crf: 30 } })
      .ffmpegOptions,
    getDefaultSettings().ffmpegOptions,
  );
  assert.throws(
    () => migrateSettings({ settingsVersion: settingsVersion + 1 }),
    validation.ValidationError,
  );
});

test("settings store persists migration and rejects invalid or unknown IPC writes atomically", () => {
  let persisted;
  class ElectronStore {
    constructor(options) {
      assert.equal(options.clearInvalidConfig, true);
      assert.equal(options.accessPropertiesByDotNotation, false);
      this.store = { showRendererWindow: false, ffmpegOptions: { crf: 25 } };
      persisted = this;
    }
    get(key) {
      return structuredClone(this.store[key]);
    }
    set(key, value) {
      this.store[key] = structuredClone(value);
    }
  }
  const { store, setSetting } = load("electron/store.ts", {
    "electron-store": { default: ElectronStore },
    "../src/domain/settings": settings,
    "../src/domain/validation": validation,
  });
  assert.equal(persisted.store.settingsVersion, settingsVersion);
  assert.equal(store.get("showRendererWindow"), false);
  assert.deepEqual(store.get("ffmpegOptions"), { crf: "25" });
  const before = structuredClone(persisted.store);
  for (const [key, value] of [
    ["unknown", true],
    ["auth.path", "x"],
    ["__proto__", {}],
    ["ffmpegOptions", { crf: 1 }],
    ["showRendererWindow", "false"],
  ]) {
    assert.throws(() => setSetting(key, value), validation.ValidationError);
    assert.deepEqual(persisted.store, before);
  }
  assert.throws(() => store.get("settingsVersion"), validation.ValidationError);
  setSetting("auth", { type: "cookie", path: "/cookies.txt" });
  assert.deepEqual(store.get("auth"), { type: "cookie", path: "/cookies.txt" });
  const template = store.get("ffmpegOptions");
  template.crf = "0";
  assert.equal(store.get("ffmpegOptions").crf, "25");
});
