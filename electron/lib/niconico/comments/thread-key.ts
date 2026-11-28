import type { V3MetadataComment } from "@/@types/niconico.js";

import { convertToEncodedCookie, getCookies } from "../../cookie.js";
import { withRequestTimeout } from "../request.js";

type ThreadKeyResponse = {
  meta?: { status?: number };
  data?: { threadKey?: unknown };
};

/**
 * コメント取得用の threadKey を取得する
 * 新仕様では視聴ページ情報に含まれる threadKey は期限切れになりうるため、
 * 取得の度に専用APIから最新のものを取得する
 * 取得に失敗した場合は視聴ページ情報に含まれていた値にフォールバックする
 */
const fetchThreadKey = async (
  metadata: V3MetadataComment,
  signal: AbortSignal,
): Promise<string> => {
  const fallback = metadata.nvComment.threadKey;
  const videoId = metadata.threads?.[0]?.videoId;
  if (!videoId) return fallback;
  try {
    const cookies = await getCookies();
    const res = await withRequestTimeout(signal, async (requestSignal) => {
      const req = await fetch(
        `https://nvapi.nicovideo.jp/v1/comment/keys/thread?${new URLSearchParams(
          { videoId },
        ).toString()}`,
        {
          signal: requestSignal,
          headers: {
            "X-Frontend-Id": "6",
            "X-Frontend-Version": "0",
            "X-Niconico-Language": "ja-jp",
            ...(cookies ? { Cookie: convertToEncodedCookie(cookies) } : {}),
          },
        },
      );
      return (await req.json()) as ThreadKeyResponse;
    });
    const key = res?.data?.threadKey;
    if (res?.meta?.status === 200 && typeof key === "string" && key) return key;
  } catch (error) {
    signal.throwIfAborted();
    console.warn("failed to refresh threadKey", error);
  }
  return fallback;
};

export { fetchThreadKey };
