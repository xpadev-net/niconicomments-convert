import {
  getAvailableChromiumProfiles,
  getChromiumCookies,
} from "./cookies/chromium";
import {
  getAvailableFirefoxProfiles,
  getFirefoxCookies,
} from "./cookies/firefox";
import { browserProfile } from "@/@types/cookies";

const getAvailableProfiles = () => {
  return [
    ...getAvailableFirefoxProfiles(),
    ...getAvailableChromiumProfiles("brave"),
    ...getAvailableChromiumProfiles("chrome"),
    ...getAvailableChromiumProfiles("chromium"),
    ...getAvailableChromiumProfiles("edge"),
    ...getAvailableChromiumProfiles("opera"),
    ...getAvailableChromiumProfiles("vivaldi"),
  ];
};

const getCookies = (profile: browserProfile) => {
  if (profile.type === "chromiumProfile") {
    return getChromiumCookies(profile);
  }
  return getFirefoxCookies(profile);
};

export { getAvailableProfiles, getCookies };
