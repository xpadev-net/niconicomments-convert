import ElectronStore from "electron-store";

import type { AppSettings } from "../src/@types/setting.js";
import {
  isSettingKey,
  migrateSettings,
  parseSetting,
} from "../src/domain/settings.js";
import { ValidationError } from "../src/domain/validation.js";

const persisted = new ElectronStore<AppSettings & { settingsVersion: number }>({
  // A syntactically broken JSON file cannot be recovered per setting.
  clearInvalidConfig: true,
  accessPropertiesByDotNotation: false,
});
persisted.store = migrateSettings(persisted.store);

const store = {
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    if (!isSettingKey(key)) throw new ValidationError("未知の設定項目です。");
    return parseSetting(key, persisted.get(key));
  },
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    if (!isSettingKey(key)) throw new ValidationError("未知の設定項目です。");
    // Dynamic key: electron-store v12 cannot narrow a generic key, and values are validated by parseSetting.
    persisted.set(key as string, parseSetting(key, value));
  },
};

const setSetting = (key: unknown, value: unknown): void => {
  if (!isSettingKey(key)) throw new ValidationError("未知の設定項目です。");
  store.set(key, parseSetting(key, value));
};

export { setSetting, store };
