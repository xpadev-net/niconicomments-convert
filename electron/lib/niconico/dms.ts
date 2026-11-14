import type { V3MetadataBody } from "@/@types/niconico";
import type { TDMSFormat } from "@/@types/queue";
import type { SpawnResult } from "@/@types/spawn";

import { typeGuard } from "../../type-guard";
import { DownloadM3U8 } from "../../utils/ffmpeg";
import {
  convertToEncodedCookie,
  formatCookies,
  getCookies,
  parseCookie,
} from "../cookie";

const downloadDMS = async (
  metadata: V3MetadataBody,
  format: TDMSFormat,
  targetPath: string,
  progress: (total: number, downloaded: number, eta: number) => void,
  signal: AbortSignal,
): Promise<SpawnResult> => {
  signal.throwIfAborted();
  if (!typeGuard.niconico.v3DMS(metadata)) {
    if (typeGuard.niconico.v3DMC(metadata)) {
      throw new Error(
        "DMS上に動画が見つかりませんでした\nDMCからの取得を試してみてください",
      );
    }
    throw new Error(
      "動画情報の取得に失敗しました。未購入の有料動画などの可能性があります",
    );
  }

  const cookie = await getCookies();
  const accessRightsReq = await fetch(
    `https://nvapi.nicovideo.jp/v1/watch/${metadata.video.id}/access-rights/hls?actionTrackId=0_0`,
    {
      signal,
      headers: {
        Host: "nvapi.nicovideo.jp",
        Cookie: cookie ? convertToEncodedCookie(cookie) : "",
        "Content-Type": "application/json",
        "X-Request-With": "https://www.nicovideo.jp",
        "X-Access-Right-Key": metadata.media.domand.accessRightKey,
        "X-Frontend-Id": "6",
        "X-Frontend-Version": "0",
      },
      body: JSON.stringify({ outputs: [format.format] }),
      method: "POST",
    },
  );
  const accessRights = (await accessRightsReq.json()) as unknown;
  if (!typeGuard.niconico.v1AccessRightsHls(accessRights)) {
    throw new Error(
      `セッションの作成に失敗しました\n${JSON.stringify(accessRights)}`,
    );
  }
  signal.throwIfAborted();
  const parsedCookie = parseCookie(...accessRightsReq.headers.getSetCookie());

  const { stop, promise } = DownloadM3U8(
    [
      "-cookies",
      formatCookies(parsedCookie, true).join("\n"),
      "-i",
      accessRights.data.contentUrl,
      "-c",
      "copy",
      targetPath,
      "-y",
    ],
    progress,
  );
  signal.addEventListener("abort", stop, { once: true });
  try {
    const result = await promise;
    signal.throwIfAborted();
    return result;
  } finally {
    signal.removeEventListener("abort", stop);
  }
};

export { downloadDMS };
