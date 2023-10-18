import type {
  BrowserProfile,
  ChromiumProfile,
  Cookies,
  FirefoxProfile,
} from "@/@types/cookies";

import {
  getAvailableChromiumProfiles,
  getChromiumCookies,
} from "./cookies/chromium";
import {
  getAvailableFirefoxProfiles,
  getFirefoxCookies,
} from "./cookies/firefox";

const getAvailableProfiles = async (): Promise<
  (FirefoxProfile | ChromiumProfile)[]
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

export { convertToEncodedCookie, getAvailableProfiles, getCookies };
