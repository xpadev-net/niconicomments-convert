import type { UserData, V3MetadataBody } from "@/@types/niconico";
import type { AuthType } from "@/@types/setting";

import { store } from "../../store";
import { typeGuard } from "../../type-guard";
import { convertToEncodedCookie, getCookies } from "../cookie";
import { encodeJson } from "../json";

const userInfoCache: { [key: string]: UserData | undefined } = {};
const getUserInfo = async (cookies: string): Promise<UserData | undefined> => {
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
    userInfoCache[cookies] = undefined;
    return undefined;
  }
  userInfoCache[cookies] = res;
  return res;
};

const getMetadata = async (
  nicoId: string,
): Promise<V3MetadataBody | undefined> => {
  const authSetting = store.get("auth") as AuthType | undefined;
  if (authSetting?.type === "browser" && authSetting.profile) {
    const cookies = convertToEncodedCookie(
      await getCookies(authSetting.profile),
    );
    const req = await fetch(
      `https://www.nicovideo.jp/watch/${nicoId}?responseType=json`,
      {
        headers: {
          Cookie: cookies,
        },
      },
    );
    const metadata = (await req.json()) as unknown;
    if (!typeGuard.niconico.WatchPageJson(metadata)) {
      return getV3GuestMetadata(nicoId);
    }
    return metadata.data.response;
  }
  if (!authSetting || authSetting.type === "NoAuth") {
    return getV3GuestMetadata(nicoId);
  }
};

const getV3GuestMetadata = async (nicoId: string): Promise<V3MetadataBody> => {
  const req = await fetch(
    `https://www.nicovideo.jp/watch/${nicoId}?responseType=json`,
  );
  const metadata = (await req.json()) as unknown;
  if (!typeGuard.niconico.WatchPageJson(metadata)) {
    throw new Error(`failed to get metadata\n${encodeJson(metadata)}`);
  }
  return metadata.data.response;
};
export { getMetadata, getUserInfo };
