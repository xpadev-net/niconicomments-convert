import type { Cookies } from "@/@types/cookies";
import type { TWatchV3Metadata } from "@/@types/niconico";
import type { TDMSFormat } from "@/@types/queue";
import type { AuthType } from "@/@types/setting";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "../../controller-window";
import { ffmpegPath } from "../../ffmpeg";
import { store } from "../../store";
import { typeGuard } from "../../type-guard";
import { time2num } from "../../utils/time";
import {
  convertToEncodedCookie,
  formatCookies,
  getCookies,
  parseCookie,
} from "../cookie";
import { spawn } from "../spawn";

let stop: (() => void) | undefined;

const downloadDMS = async (
  metadata: TWatchV3Metadata,
  format: TDMSFormat,
  targetPath: string,
  progress: (total: number, downloaded: number) => void,
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

  const cookie = await (async (): Promise<Cookies | undefined> => {
    const authSetting = store.get("auth") as AuthType | undefined;
    if (authSetting?.type === "browser" && authSetting.profile) {
      return await getCookies(authSetting.profile);
    }
    return undefined;
  })();
  const accessRightsReq = await fetch(
    `https://nvapi.nicovideo.jp/v1/watch/${metadata.data.video.id}/access-rights/hls?actionTrackId=0_0`,
    {
      headers: {
        Host: "nvapi.nicovideo.jp",
        Cookie: cookie ? convertToEncodedCookie(cookie) : "",
        "Content-Type": "application/json",
        "X-Request-With": "https://www.nicovideo.jp",
        "X-Access-Right-Key": metadata.data.media.domand.accessRightKey,
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

  let total = 0,
    downloaded = 0;
  const onData = (data: string): void => {
    let match;
    if ((match = data.match(/Duration: ([0-9:.]+),/))) {
      total = time2num(match[1]);
    } else if ((match = data.match(/time=([0-9:.]+) /))) {
      downloaded = time2num(match[1]);
    }
    progress(total, downloaded);
  };
  const _spawn = spawn(
    ffmpegPath,
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
    undefined,
    onData,
    onData,
  );
  let cancelled = false;
  stop = () => {
    cancelled = true;
    _spawn.stop();
  };
  try {
    return await _spawn.promise;
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
