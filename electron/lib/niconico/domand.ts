import type { AxiosResponse } from "axios";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import type * as Stream from "stream";

import type { Cookies, ParsedCookie } from "@/@types/cookies";
import type { TWatchV3Metadata } from "@/@types/niconico";
import type { TDomandFormat } from "@/@types/queue";
import type { AuthType } from "@/@types/setting";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "../../controllerWindow";
import { ffmpegPath } from "../../ffmpeg";
import { store } from "../../store";
import { typeGuard } from "../../typeGuard";
import {
  convertToEncodedCookie,
  filterCookies,
  formatCookies,
  getCookies,
  parseCookie,
} from "../cookie";
import { spawn } from "../spawn";

const downloadDomand = async (
  nicoId: string,
  metadata: TWatchV3Metadata,
  format: TDomandFormat,
  targetPath: string,
  progress: (total: number, downloaded: number) => void,
): Promise<SpawnResult | undefined> => {
  if (!typeGuard.niconico.v3Domand(metadata)) {
    if (typeGuard.niconico.v3Delivery(metadata)) {
      console.log(metadata);
      sendMessageToController({
        title: "動画情報の取得に失敗しました",
        message:
          "Domandサーバー上に動画が見つかりませんでした\nDMCサーバーからの取得を試してみてください\nniconico / download / downloadDomand / invalid server",
        type: "message",
      });
      return;
    }
    sendMessageToController({
      title: "動画情報の取得に失敗しました",
      message:
        "未購入の有料動画などの可能性があります\nniconico / download / invalid metadata",
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
    `https://nvapi.nicovideo.jp/v1/watch/${nicoId}/access-rights/hls?actionTrackId=0_0`,
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
niconico / download / invalid metadata`,
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
    manifestRaw.match(/https:\/\/.+?\.nicovideo\.jp\/.+?\.m3u8/g) || [],
  );
  const getManifestUrl = (format: string): string | undefined => {
    for (const url of manifests) {
      if (url.endsWith(`/${format}.m3u8`)) {
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

    await spawn(
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
  } catch {
    // handle error
  } finally {
    try {
      if (tmpDir) {
        //fs.rmSync(tmpDir, { recursive: true });
      }
    } catch (e) {
      console.error(
        `An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`,
      );
    }
  }
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
  const key = manifest.match(/https:\/\/.+?\.nicovideo\.jp\/.+?\.key/g)?.[0];
  if (!key) {
    throw new Error("failed to get key");
  }
  return {
    segments: Array.from(
      manifest.match(/https:\/\/.+?\.nicovideo\.jp\/.+?\.cmf[av]/g) || [],
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

export { downloadDomand };
