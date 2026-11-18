import { defaultOptions } from "../../electron/const.js";
import type { BrowserProfile } from "../@types/cookies.js";
import type { AppSettings, AuthType } from "../@types/setting.js";
import { isRecord, ValidationError } from "./validation.js";

const settingsVersion = 1;
const getDefaultSettings = (): AppSettings => ({
  auth: { type: "NoAuth" },
  ffmpegOptions: { ...defaultOptions },
  showRendererWindow: true,
  commentFileExt: ".json",
  updateCheck: "unset",
});

const isNonemptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isBrowserProfile = (value: unknown): value is BrowserProfile => {
  if (
    !isRecord(value) ||
    !isNonemptyString(value.name) ||
    !isNonemptyString(value.path)
  )
    return false;
  if (value.type === "chromiumProfile")
    return (
      typeof value.browser === "string" &&
      ["brave", "chrome", "chromium", "edge", "opera", "vivaldi"].includes(
        value.browser,
      ) &&
      isNonemptyString(value.profileName)
    );
  if (value.browser !== "firefox") return false;
  if (value.type === "firefoxBasicProfile") return true;
  return (
    value.type === "firefoxContainer" &&
    isNonemptyString(value.profileName) &&
    isNonemptyString(value.containerName) &&
    typeof value.contextId === "number" &&
    Number.isSafeInteger(value.contextId) &&
    value.contextId > 0
  );
};

const isAuth = (value: unknown): value is AuthType => {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "NoAuth":
      return true;
    case "cookie":
      return isNonemptyString(value.path);
    case "browser":
      return value.profile === undefined || isBrowserProfile(value.profile);
    default:
      return false;
  }
};

const validators: {
  [K in keyof AppSettings]: (value: unknown) => value is AppSettings[K];
} = {
  auth: isAuth,
  ffmpegOptions: (value): value is AppSettings["ffmpegOptions"] =>
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string"),
  showRendererWindow: (value): value is boolean => typeof value === "boolean",
  commentFileExt: (value): value is string =>
    typeof value === "string" && /^\.[a-z0-9]+$/i.test(value),
  updateCheck: (value): value is AppSettings["updateCheck"] =>
    value === "unset" || value === "enabled" || value === "disabled",
};

const isSettingKey = (key: unknown): key is keyof AppSettings =>
  typeof key === "string" && Object.hasOwn(validators, key);

const parseSetting = <K extends keyof AppSettings>(
  key: K,
  value: unknown,
): AppSettings[K] => {
  const validate = validators[key];
  if (!validate(value)) throw new ValidationError(`設定「${key}」が不正です。`);
  return value;
};

// Version 0 is the existing flat, unversioned store. Preserve valid settings,
// replace invalid/missing settings independently, then persist version 1.
// Numeric FFmpeg option values from old files become strings during migration
// only; new writes must already satisfy the current schema.
const migrateSettings = (input: unknown) => {
  const raw = isRecord(input) ? input : {};
  if (
    typeof raw.settingsVersion === "number" &&
    raw.settingsVersion > settingsVersion
  )
    throw new ValidationError(
      "このアプリより新しい形式の設定は読み込めません。",
    );
  const legacy = raw.settingsVersion === undefined || raw.settingsVersion === 0;
  let ffmpegOptions = raw.ffmpegOptions;
  if (legacy && isRecord(ffmpegOptions)) {
    ffmpegOptions = Object.fromEntries(
      Object.entries(ffmpegOptions).map(([key, value]) => [
        key,
        typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : value,
      ]),
    );
  }
  const defaults = getDefaultSettings();
  const restore = <K extends keyof AppSettings>(key: K, value: unknown) =>
    validators[key](value) ? value : defaults[key];
  return {
    settingsVersion,
    auth: restore("auth", raw.auth),
    ffmpegOptions: restore("ffmpegOptions", ffmpegOptions),
    showRendererWindow: restore("showRendererWindow", raw.showRendererWindow),
    commentFileExt: restore("commentFileExt", raw.commentFileExt),
    updateCheck: restore("updateCheck", raw.updateCheck),
  };
};

export {
  getDefaultSettings,
  isSettingKey,
  migrateSettings,
  parseSetting,
  settingsVersion,
};
