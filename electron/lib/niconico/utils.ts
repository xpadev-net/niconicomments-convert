import type { TWatchV3Metadata, UserData } from "@/@types/niconico";
import type { AuthType } from "@/@types/setting";

import { store } from "../../store";
import { typeGuard } from "../../typeGuard";
import { convertToEncodedCookie, getCookies } from "../cookie";
import { encodeJson } from "../json";

const userInfoCache: { [key: string]: UserData | false } = {};
const getUserInfo = async (cookies: string): Promise<UserData | false> => {
  if (Object.prototype.hasOwnProperty.call(userInfoCache, cookies))
    return userInfoCache[cookies];
  const req = await fetch(
    "https://account.nicovideo.jp/api/public/v2/user.json",
    {
      headers: {
        Cookie: cookies,
      },
    },
  );
  const res = (await req.json()) as unknown;
  if (!typeGuard.niconico.userData(res)) {
    userInfoCache[cookies] = false;
    return false;
  }
  userInfoCache[cookies] = res;
  return res;
};

const getMetadata = async (
  nicoId: string,
): Promise<TWatchV3Metadata | undefined> => {
  const authSetting = store.get("auth") as AuthType | undefined;
  if (authSetting?.type === "browser" && authSetting.profile) {
    const cookies = convertToEncodedCookie(
      await getCookies(authSetting.profile),
    );
    const req = await fetch(
      `https://www.nicovideo.jp/api/watch/v3/${nicoId}?_frontendId=6&_frontendVersion=0&actionTrackId=0_0`,
      {
        headers: {
          Cookie: cookies,
        },
      },
    );
    const metadata = (await req.json()) as unknown;
    if (!typeGuard.niconico.TWatchV3Metadata(metadata)) {
      return getV3GuestMetadata(nicoId);
    }
    return metadata;
  }
  if (!authSetting || authSetting.type === "NoAuth") {
    return getV3GuestMetadata(nicoId);
  }
};

const getV3GuestMetadata = async (
  nicoId: string,
): Promise<TWatchV3Metadata> => {
  const req = await fetch(
    `https://www.nicovideo.jp/api/watch/v3_guest/${nicoId}?_frontendId=6&_frontendVersion=0&actionTrackId=0_0`,
  );
  const metadata = (await req.json()) as unknown;
  if (!typeGuard.niconico.TWatchV3Metadata(metadata)) {
    throw new Error(`failed to get metadata\n${encodeJson(metadata)}`);
  }
  return metadata;
};
export { getMetadata, getUserInfo };
