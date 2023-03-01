import * as path from "path";
import * as fs from "fs";
import type {
  Cookies,
  firefoxContainer,
  firefoxProfile,
  firefoxProfiles,
  l10nID,
  moz_cookies,
} from "@/@types/cookies";
import * as sqlite3 from "sqlite3";
import { fetchAll } from "#/lib/db";
import { typeGuard } from "#/typeGuard";

const getFirefoxRootDir = () => {
  if (process.platform === "win32") {
    if (!process.env.APPDATA) throw new Error("fail to resolve appdata");
    return path.join(process.env.APPDATA, "Mozilla/Firefox/Profiles");
  }
  return "~/Library/Application Support/Firefox";
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

const getFirefoxProfileCookies = async (profile: firefoxProfile) => {
  const db = new sqlite3.Database(profile.path, sqlite3.OPEN_READONLY);
  const cookies: Cookies = {};
  const rows = (await fetchAll(
    db,
    `SELECT host, name, value, path, expiry, isSecure FROM moz_cookies WHERE NOT INSTR(originAttributes,"userContextId=")`
  )) as moz_cookies;

  for (const row of rows) {
    if (row.host.match(/^\.nicovideo\.jp/) && row.path === "/") {
      cookies[row.name] = row.value;
    }
  }
  return cookies;
};

const getFirefoxContainerCookies = async (profile: firefoxContainer) => {
  const db = new sqlite3.Database(profile.path, sqlite3.OPEN_READONLY);
  const cookies: Cookies = {};
  const rows = (await fetchAll(
    db,
    `SELECT host, name, value, path, expiry, isSecure FROM moz_cookies WHERE originAttributes LIKE ? OR originAttributes LIKE ?`,
    [
      `%userContextId=${profile.contextId}`,
      `%userContextId=${profile.contextId}&%`,
    ]
  )) as moz_cookies;
  for (const row of rows) {
    if (row.host.match(/^\.nicovideo\.jp/) && row.path === "/") {
      cookies[row.name] = row.value;
    }
  }
  return cookies;
};

export {
  getAvailableFirefoxProfiles,
  getFirefoxProfileCookies,
  getFirefoxContainerCookies,
};
