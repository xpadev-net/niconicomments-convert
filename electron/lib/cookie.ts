import type {
  ChromiumProfile,
  Cookies,
  FirefoxProfile,
  ParsedCookie,
} from "@/@types/cookies";
import type { UserData } from "@/@types/niconico";

import * as fs from "node:fs/promises";
import type { AuthType } from "@/@types/setting";
import { store } from "../store";
import { typeGuard } from "../type-guard";
import {
  getAvailableChromiumProfiles,
  getChromiumCookies,
} from "./cookies/chromium";
import {
  getAvailableFirefoxProfiles,
  getFirefoxCookies,
} from "./cookies/firefox";

const getAvailableProfiles = async (): Promise<
  { profile: FirefoxProfile | ChromiumProfile; user: UserData }[]
> => {
  return [
    ...(await getAvailableFirefoxProfiles()),
    ...(await getAvailableChromiumProfiles("brave")),
    ...(await getAvailableChromiumProfiles("chrome")),
    ...(await getAvailableChromiumProfiles("chromium")),
    ...(await getAvailableChromiumProfiles("edge")),
    ...(await getAvailableChromiumProfiles("opera")),
    ...(await getAvailableChromiumProfiles("vivaldi")),
  ];
};

const getCookies = async (): Promise<Cookies | undefined> => {
  const authSetting = store.get("auth") as AuthType | undefined;
  if (!authSetting) {
    return undefined;
  }
  switch (authSetting.type) {
    case "browser": {
      if (!authSetting.profile) {
        return undefined;
      }
      switch (authSetting.profile.type) {
        case "chromiumProfile":
          return await getChromiumCookies(authSetting.profile);
        default:
          return await getFirefoxCookies(authSetting.profile);
      }
    }
    case "cookie": {
      return await readCookieTxt(authSetting.path);
    }
  }
};

const readCookieTxt = async (path: string): Promise<Cookies | undefined> => {
  try {
    return (await fs.readFile(path, "utf-8"))
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const parts = line.split("\t").map((part) => part.trim());
        return {
          domain: parts[0],
          path: parts[2],
          name: parts[5],
          value: parts[6],
        };
      })
      .filter((cookie) => cookie.domain.match(/\.nicovideo\.jp/))
      .reduce((pv, current) => {
        if (pv[current.name]) {
          console.warn(`Duplicate cookie found: ${current.name}`);
        }
        pv[current.name] = current.value;
        return pv;
      }, {} as Cookies);
  } catch (error) {
    console.error("Error reading cookie file:", error);
    return undefined;
  }
};

const convertToEncodedCookie = (cookie: Cookies): string => {
  let cookieString = "";
  for (const key in cookie) {
    const value = cookie[key];
    if (cookieString) cookieString += "; ";
    cookieString += `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
  return cookieString;
};

const parseCookie = (...cookies: string[]): ParsedCookie[] => {
  const result: ParsedCookie[] = [];
  for (const cookie of cookies) {
    const parts = cookie.split(/;\s*/);
    const item: Partial<ParsedCookie> = {};
    parts.forEach((part, index) => {
      const [key, value] = part.split("=");
      if (index === 0) {
        item.key = decodeURIComponent(key);
        item.value = decodeURIComponent(value);
        return;
      }
      if (typeGuard.cookie.parsedCookieKey(key)) item[key] = value;
    });
    result.push(item as ParsedCookie);
  }
  return result;
};

const formatCookies = (
  cookies: ParsedCookie[],
  addSuffix = false,
): string[] => {
  return cookies.map((cookie) => {
    return `${cookie.key}=${cookie.value}${
      addSuffix ? `; domain=${cookie.domain}; path=${cookie.path}` : ""
    }`;
  });
};

export {
  convertToEncodedCookie,
  formatCookies,
  getAvailableProfiles,
  getCookies,
  parseCookie,
};
