import type {
  BrowserProfile,
  ChromiumProfile,
  Cookies,
  FirefoxProfile,
  ParsedCookie,
} from "@/@types/cookies";
import type { UserData } from "@/@types/niconico";

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

const getCookies = (profile: BrowserProfile): Promise<Cookies> => {
  if (profile.type === "chromiumProfile") {
    return getChromiumCookies(profile);
  }
  return getFirefoxCookies(profile);
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

const filterCookies = (
  cookies: ParsedCookie[],
  url: string,
): ParsedCookie[] => {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const path = urlObj.pathname;
  const result: ParsedCookie[] = [];
  for (const cookie of cookies) {
    if (
      domain.endsWith(cookie.domain ?? "") &&
      path.startsWith(cookie.path ?? "")
    ) {
      result.push(cookie);
    }
  }
  return result;
};

const formatCookies = (
  cookies: ParsedCookie[],
  addSuffix: boolean = false,
): string[] => {
  return cookies.map((cookie) => {
    return `${cookie.key}=${cookie.value}${
      addSuffix ? `; domain=${cookie.domain}; path=${cookie.path}` : ""
    }`;
  });
};

export {
  convertToEncodedCookie,
  filterCookies,
  formatCookies,
  getAvailableProfiles,
  getCookies,
  parseCookie,
};
