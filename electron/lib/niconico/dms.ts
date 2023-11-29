import type { AxiosResponse } from "axios";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import type * as Stream from "stream";

import type { Cookies, ParsedCookie } from "@/@types/cookies";
import type { TWatchV3Metadata } from "@/@types/niconico";
import type { TDMSFormat } from "@/@types/queue";
import type { AuthType } from "@/@types/setting";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "../../controller-window";
import { ffmpegPath } from "../../ffmpeg";
import { store } from "../../store";
import { typeGuard } from "../../type-guard";
import {
  convertToEncodedCookie,
  filterCookies,
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

  const manifestReq = await fetchWithCookie(
    accessRights.data.contentUrl,
    undefined,
    parsedCookie,
  );
  const manifestRaw = await manifestReq.text();
  const manifests = Array.from(
    manifestRaw.match(/https:\/\/.+?\.nicovideo\.jp\/.+?\.m3u8[^"]+/g) ?? [],
  );
  const getManifestUrl = (format: string): string | undefined => {
    for (const url of manifests) {
      if (url.match(`/${format}.m3u8`)) {
        return url;
      }
    }
    return undefined;
  };

  const getManifests = async (
    format: string,
  ): Promise<{ segments: string[]; key: string; manifest: string }> => {
    const manifestUrl = getManifestUrl(format);
    if (!manifestUrl) {
      throw new Error("failed to get manifest");
    }
    const manifestReq = await fetchWithCookie(
      manifestUrl,
      undefined,
      parsedCookie,
    );
    const manifest = await manifestReq.text();
    return { ...getSegments(manifest), manifest };
  };

  const downloadSegments = async (
    dir: string,
    format: string,
    segments: string[],
    key: string,
    manifest: string,
    progress: () => void,
  ): Promise<string> => {
    const replaceMap = new Map<string, string>();
    for (const segment of segments) {
      const segmentUrl = new URL(segment);
      const outputPath = path.join(
        dir,
        segmentUrl.pathname.split("/").pop() ?? "",
      );
      await downloadFile(segment, outputPath, {
        Cookie: formatCookies(filterCookies(parsedCookie, segment), false).join(
          ";",
        ),
      });
      progress();
      replaceMap.set(segment, outputPath);
    }
    const keyUrl = new URL(key);
    const keyPath = path.join(dir, keyUrl.pathname.split("/").pop() ?? "");
    await downloadFile(key, keyPath, {
      Cookie: formatCookies(filterCookies(parsedCookie, key), false).join(";"),
    });
    replaceMap.set(key, keyPath);
    replaceMap.forEach((value, key) => {
      manifest = manifest.replace(key, value.replace(/\\/g, "\\\\"));
    });
    const manifestPath = path.join(dir, format + ".m3u8");
    fs.writeFileSync(manifestPath, manifest);
    return manifestPath.replace(/\\/g, "\\\\");
  };

  let tmpDir: string = "";
  let result: SpawnResult | undefined;
  let cancelled = false;
  try {
    tmpDir = fs.mkdtempSync(
      path.join(path.dirname(targetPath), path.basename(targetPath)),
    );
    const {
      segments: videoSegments,
      key: videoKey,
      manifest: videoManifest,
    } = await getManifests(format.format[0]);
    const {
      segments: audioSegments,
      key: audioKey,
      manifest: audioManifest,
    } = await getManifests(format.format[1]);
    const totalSegments = videoSegments.length + audioSegments.length;
    let downloadedSegments = 0;
    const onProgress = (): void => {
      downloadedSegments++;
      progress(totalSegments, downloadedSegments);
    };
    const videoManifestPath = await downloadSegments(
      tmpDir,
      format.format[0],
      videoSegments,
      videoKey,
      videoManifest,
      onProgress,
    );
    const audioManifestPath = await downloadSegments(
      tmpDir,
      format.format[1],
      audioSegments,
      audioKey,
      audioManifest,
      onProgress,
    );

    const _spawn = spawn(
      ffmpegPath,
      [
        "-allowed_extensions",
        "ALL",
        "-i",
        videoManifestPath,
        "-allowed_extensions",
        "ALL",
        "-i",
        audioManifestPath,
        "-c",
        "copy",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        targetPath,
        "-y",
        "-loglevel",
        "debug",
      ],
      undefined,
      (data) => console.log(data),
      (data) => console.log(data),
    );
    stop = () => {
      cancelled = true;
      _spawn.stop();
    };
    result = await _spawn.promise;
  } catch {
    if (!cancelled) {
      sendMessageToController({
        title: "動画のダウンロードに失敗しました",
        message:
          "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください\nlib/niconico/dms.ts / downloadDMS / failed to download",
        type: "message",
      });
    }
  } finally {
    try {
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    } catch (e) {
      console.error(
        `An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`,
      );
    }
  }
  return result;
};

const interruptDMS = (): void => {
  stop?.();
};

const fetchWithCookie = (
  input: string,
  init: RequestInit | undefined,
  cookies: ParsedCookie[],
): Promise<Response> => {
  return fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: formatCookies(filterCookies(cookies, input), false).join(";"),
    },
  });
};

const getSegments = (manifest: string): { segments: string[]; key: string } => {
  const key = manifest.match(
    /https:\/\/.+?\.nicovideo\.jp\/.+?\.key[^"\n]*/g,
  )?.[0];
  if (!key) {
    throw new Error("failed to get key");
  }
  return {
    segments: Array.from(
      manifest.match(/https:\/\/.+?\.nicovideo\.jp\/.+?\.cmf[av][^"\n]*/g) ??
        [],
    ),
    key,
  };
};

const downloadFile = async (
  url: string,
  path: string,
  headers: { [key: string]: string },
  progress?: (progress: number) => void,
): Promise<void> => {
  const file = fs.createWriteStream(path);
  return axios(url, {
    method: "get",
    headers,
    responseType: "stream",
    onDownloadProgress: (status) =>
      progress?.(status.loaded / (status.total ?? 1)),
  }).then((res: AxiosResponse<Stream>) => {
    return new Promise<void>((resolve, reject) => {
      res.data.pipe(file);
      let error: Error;
      file.on("error", (err) => {
        error = err;
        file.close();
        reject(err);
      });
      file.on("close", () => {
        if (!error) {
          resolve();
        }
      });
    });
  });
};

export { downloadDMS, interruptDMS };
