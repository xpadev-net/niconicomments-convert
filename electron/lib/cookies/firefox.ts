import * as fs from "node:fs";
import * as path from "node:path";

import type {
  Cookies,
  FirefoxProfile,
  l10nID,
  moz_cookies,
} from "@/@types/cookies";
import type { UserData } from "@/@types/niconico";

import { typeGuard } from "../../type-guard";
import { convertToEncodedCookie } from "../cookie";
import { fetchAll, openClonedDB } from "../db";
import { getUserInfo } from "../niconico";

/*
reference source:
 - https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/cookies.py
  Released under The Unlicense
 */

const getFirefoxRootDir = (): string => {
  if (process.platform === "win32") {
    if (!process.env.APPDATA) throw new Error("fail to resolve appdata");
    return path.join(process.env.APPDATA, "Mozilla/Firefox/Profiles");
  }
  if (!process.env.HOME) throw new Error("fail to resolve home dir");
  return path.join(
    process.env.HOME,
    "Library/Application Support/Firefox/Profiles",
  );
};

const containerNames: { [key in l10nID]: string } = {
  "userContextPersonal.label": "個人",
  "userContextWork.label": "仕事",
  "userContextBanking.label": "銀行取引",
  "userContextShopping.label": "ショッピング",
};

const getAvailableFirefoxProfiles = async (): Promise<
  { profile: FirefoxProfile; user: UserData }[]
> => {
  const rootDir = getFirefoxRootDir();
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const files = fs.readdirSync(rootDir);
  const profiles: { profile: FirefoxProfile; user: UserData }[] = [];
  const addProfile = async (profile: FirefoxProfile): Promise<void> => {
    const user = await getUser(profile);
    if (user) {
      profiles.push({ profile, user });
    }
  };
  for (const item of files) {
    const directoryName = path.join(rootDir, item);
    const dbPath = path.join(directoryName, "cookies.sqlite");
    if (!fs.existsSync(dbPath)) {
      continue;
    }
    await addProfile({
      type: "firefoxBasicProfile",
      browser: "firefox",
      name: item,
      path: directoryName,
    });
    const containersPath = path.join(directoryName, "containers.json");
    if (!fs.existsSync(containersPath)) {
      continue;
    }
    try {
      const containers = JSON.parse(
        fs.readFileSync(containersPath, "utf8"),
      ) as unknown;
      if (!typeGuard.firefox.containers(containers)) continue;
      for (const container of containers.identities) {
        if (!container.public) {
          continue;
        }
        if (typeGuard.firefox.defaultContainer(container)) {
          await addProfile({
            type: "firefoxContainer",
            browser: "firefox",
            name: `${item} (${containerNames[container.l10nID]})`,
            path: directoryName,
            profileName: item,
            containerName: container.l10nID,
            contextId: container.userContextId,
          });
          continue;
        }
        await addProfile({
          type: "firefoxContainer",
          browser: "firefox",
          name: `${item} (${container.name})`,
          path: directoryName,
          profileName: item,
          containerName: container.name,
          contextId: container.userContextId,
        });
      }
    } catch (_) {
      console.warn(_);
    }
  }
  return profiles;
};

const getUser = async (
  profile: FirefoxProfile,
): Promise<UserData | undefined> => {
  const cookies = await getFirefoxCookies(profile);
  if (!(cookies.user_session && cookies.user_session_secure)) return;
  return await getUserInfo(convertToEncodedCookie(cookies));
};

const getFirefoxCookies = async (profile: FirefoxProfile): Promise<Cookies> => {
  const db = openClonedDB(path.join(profile.path, "cookies.sqlite"));
  const cookies: Cookies = {};
  const rows = (await (async () => {
    if (profile.type === "firefoxBasicProfile") {
      return await fetchAll(
        db,
        `SELECT host, name, value, path, expiry, isSecure FROM moz_cookies WHERE NOT INSTR(originAttributes,"userContextId=")`,
      );
    }
    return await fetchAll(
      db,
      "SELECT host, name, value, path, expiry, isSecure FROM moz_cookies WHERE originAttributes LIKE ? OR originAttributes LIKE ?",
      [
        `%userContextId=${profile.contextId}`,
        `%userContextId=${profile.contextId}&%`,
      ],
    );
  })()) as moz_cookies;

  for (const row of rows) {
    if (row.host.match(/\.nicovideo\.jp/)) {
      cookies[row.name] = row.value;
    }
  }
  return cookies;
};

export { getAvailableFirefoxProfiles, getFirefoxCookies };
