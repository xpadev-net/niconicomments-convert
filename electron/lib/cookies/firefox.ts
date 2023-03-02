import * as path from "path";
import * as fs from "fs";
import type {
  Cookies,
  firefoxProfiles,
  l10nID,
  moz_cookies,
} from "@/@types/cookies";
import { fetchAll, openClonedDB } from "../db";
import { typeGuard } from "../../typeGuard";

const getFirefoxRootDir = () => {
  if (process.platform === "win32") {
    if (!process.env.APPDATA) throw new Error("fail to resolve appdata");
    return path.join(process.env.APPDATA, "Mozilla/Firefox/Profiles");
  }
  if (!process.env.HOME) throw new Error("fail to resolve home dir");
  return path.join(
    process.env.HOME,
    "Library/Application Support/Firefox/Profiles"
  );
};

const containerNames: { [key in l10nID]: string } = {
  "userContextPersonal.label": "個人",
  "userContextWork.label": "仕事",
  "userContextBanking.label": "銀行取引",
  "userContextShopping.label": "ショッピング",
};

const getAvailableFirefoxProfiles = () => {
  const rootDir = getFirefoxRootDir();
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const files = fs.readdirSync(rootDir);
  const profiles: firefoxProfiles[] = [];
  for (const item of files) {
    const directoryName = path.join(rootDir, item);
    const dbPath = path.join(directoryName, "cookies.sqlite");
    if (!fs.existsSync(dbPath)) {
      continue;
    }
    profiles.push({ type: "firefoxProfile", name: item, path: dbPath });
    const containersPath = path.join(directoryName, "containers.json");
    if (!fs.existsSync(containersPath)) {
      continue;
    }
    try {
      const containers = JSON.parse(
        fs.readFileSync(containersPath, "utf8")
      ) as unknown;
      if (!typeGuard.firefox.containers(containers)) continue;
      for (const container of containers.identities) {
        if (!container.public) {
          continue;
        }
        if (typeGuard.firefox.defaultContainer(container)) {
          profiles.push({
            type: "firefoxContainer",
            name: `${item} (${containerNames[container.l10nID]})`,
            path: dbPath,
            contextId: container.userContextId,
          });
          continue;
        }
        profiles.push({
          type: "firefoxContainer",
          name: `${item} (${container.name})`,
          path: dbPath,
          contextId: container.userContextId,
        });
      }
    } catch (_) {
      console.warn(_);
    }
  }
  return profiles;
};

const getFirefoxCookies = async (profile: firefoxProfiles) => {
  const db = openClonedDB(profile.path);
  const cookies: Cookies = {};
  const rows = (await (async () => {
    if (profile.type === "firefoxProfile") {
      return await fetchAll(
        db,
        `SELECT host, name, value, path, expiry, isSecure FROM moz_cookies WHERE NOT INSTR(originAttributes,"userContextId=")`
      );
    }
    return await fetchAll(
      db,
      `SELECT host, name, value, path, expiry, isSecure FROM moz_cookies WHERE originAttributes LIKE ? OR originAttributes LIKE ?`,
      [
        `%userContextId=${profile.contextId}`,
        `%userContextId=${profile.contextId}&%`,
      ]
    );
  })()) as moz_cookies;

  for (const row of rows) {
    if (row.host.match(/^\.nicovideo\.jp/) && row.path === "/") {
      cookies[row.name] = row.value;
    }
  }
  return cookies;
};

export { getAvailableFirefoxProfiles, getFirefoxCookies };
