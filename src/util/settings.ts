import type { AppSettings } from "../@types/setting";
import { parseSetting } from "../domain/settings";

const getSetting = async <K extends keyof AppSettings>(
  key: K,
): Promise<AppSettings[K]> =>
  parseSetting(
    key,
    await window.api.request({ type: "getSetting", host: "controller", key }),
  );

export { getSetting };
