import type { UserData, V3MetadataBody } from "@/@types/niconico.js";

import { typeGuard } from "../../type-guard.js";
import { convertToEncodedCookie, getCookies } from "../cookie.js";
import { encodeJson } from "../json.js";

const userInfoCache: { [key: string]: UserData | undefined } = {};
const getUserInfo = async (cookies: string): Promise<UserData | undefined> => {
  if (Object.hasOwn(userInfoCache, cookies)) return userInfoCache[cookies];
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
  signal?: AbortSignal,
): Promise<V3MetadataBody | undefined> => {
  signal?.throwIfAborted();
  const cookies = await getCookies();
  signal?.throwIfAborted();
  if (!cookies) {
    return getV3GuestMetadata(nicoId, signal);
  }
  const req = await fetch(
    `https://www.nicovideo.jp/watch/${nicoId}?responseType=json`,
    {
      signal,
      headers: {
        Cookie: convertToEncodedCookie(cookies),
      },
    },
  );
  const metadata = (await req.json()) as unknown;
  if (!typeGuard.niconico.WatchPageJson(metadata)) {
    return getV3GuestMetadata(nicoId, signal);
  }
  return metadata.data.response;
};

const getV3GuestMetadata = async (
  nicoId: string,
  signal?: AbortSignal,
): Promise<V3MetadataBody> => {
  const req = await fetch(
    `https://www.nicovideo.jp/watch/${nicoId}?responseType=json`,
    { signal },
  );
  const metadata = (await req.json()) as unknown;
  if (!typeGuard.niconico.WatchPageJson(metadata)) {
    throw new Error(`failed to get metadata\n${encodeJson(metadata)}`);
  }
  return metadata.data.response;
};

export { getMetadata, getUserInfo };
