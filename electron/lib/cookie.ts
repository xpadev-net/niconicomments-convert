import {
  getAvailableChromiumProfiles,
  getChromiumCookies,
} from "./cookies/chromium";
import {
  getAvailableFirefoxProfiles,
  getFirefoxCookies,
} from "./cookies/firefox";
import { browserProfile } from "@/@types/cookies";

const getAvailableProfiles = async () => {
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

const getCookies = (profile: browserProfile) => {
  if (profile.type === "chromiumProfile") {
    return getChromiumCookies(profile);
  }
  return getFirefoxCookies(profile);
};

export { getAvailableProfiles, getCookies };
