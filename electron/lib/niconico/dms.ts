import type { Cookies } from "@/@types/cookies";
import type { TWatchV3Metadata, V3MetadataBody } from "@/@types/niconico";
import type { TDMSFormat } from "@/@types/queue";
import type { AuthType } from "@/@types/setting";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "../../controller-window";
import { store } from "../../store";
import { typeGuard } from "../../type-guard";
import { DownloadM3U8 } from "../../utils/ffmpeg";
import {
  convertToEncodedCookie,
  formatCookies,
  getCookies,
  parseCookie,
} from "../cookie";

let stop: (() => void) | undefined;

const downloadDMS = async (
  metadata: V3MetadataBody,
  format: TDMSFormat,
  targetPath: string,
  progress: (total: number, downloaded: number, eta: number) => void,
): Promise<SpawnResult | undefined> => {
  if (!typeGuard.niconico.v3DMS(metadata)) {
    if (typeGuard.niconico.v3DMC(metadata)) {
      sendMessageToController({
        title: "動画情報の取得に失敗しました",
        message:
          "DMS上に動画が見つかりませんでした\nDMCからの取得を試してみてください\nlib/niconico/dms.ts / downloadDMS / invalid server",
        type: "message",
      });
      return;
    }
    sendMessageToController({
      title: "動画情報の取得に失敗しました",
      message:
        "未購入の有料動画などの可能性があります\nlib/niconico/dms.ts / downloadDMS / invalid metadata",
      type: "message",
    });
    return;
  }

  const cookie = await getCookies();
  const accessRightsReq = await fetch(
    `https://nvapi.nicovideo.jp/v1/watch/${metadata.video.id}/access-rights/hls?actionTrackId=0_0`,
    {
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
    sendMessageToController({
      title: "セッションの作成に失敗しました",
      message: `以下のテキストともに開発者までお問い合わせください
"${JSON.stringify(accessRights)}"
lib/niconico/dms.ts / downloadDMS / invalid accessRights`,
      type: "message",
    });
    return;
  }
  const parsedCookie = parseCookie(...accessRightsReq.headers.getSetCookie());

  const { stop: _stop, promise } = DownloadM3U8(
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
  let cancelled = false;
  stop = () => {
    cancelled = true;
    _stop();
  };
  try {
    return await promise;
  } catch {
    if (!cancelled) {
      sendMessageToController({
        title: "動画のダウンロードに失敗しました",
        message:
          "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください\nlib/niconico/dms.ts / downloadDMS / failed to download",
        type: "message",
      });
    }
  }
};

const interruptDMS = (): void => {
  stop?.();
};

export { downloadDMS, interruptDMS };
