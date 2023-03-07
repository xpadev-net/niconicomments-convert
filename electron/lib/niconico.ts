import { store } from "../store";
import { authType } from "@/@types/setting";
import { typeGuard } from "../typeGuard";
import { convertToEncodedCookie, getCookies } from "./cookie";
import { NicovideoFormat } from "@/@types/queue";
import { sendMessageToController } from "../controllerWindow";
import {
  createSessionRequest,
  UserData,
  watchV3Metadata,
} from "@/@types/niconico";
import { spawn } from "./spawn";
import { ffmpegPath } from "../ffmpeg";
import { encodeJson } from "./json";

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
    }
  );
  const res = (await req.json()) as unknown;
  if (!typeGuard.niconico.userData(res)) {
    userInfoCache[cookies] = false;
    return false;
  }
  userInfoCache[cookies] = res;
  return res;
};

const getMetadata = async (nicoId: string) => {
  const authSetting = store.get("auth") as authType | undefined;
  if (authSetting?.type === "browser" && authSetting.profile) {
    const cookies = convertToEncodedCookie(
      await getCookies(authSetting.profile)
    );
    const req = await fetch(
      `https://www.nicovideo.jp/api/watch/v3/${nicoId}?_frontendId=6&_frontendVersion=0&actionTrackId=0_0`,
      {
        headers: {
          Cookie: cookies,
        },
      }
    );
    const metadata = (await req.json()) as unknown;
    if (!typeGuard.niconico.watchV3Metadata(metadata)) {
      return getV3GuestMetadata(nicoId);
    }
    return metadata;
  }
  if (!authSetting || authSetting.type === "noAuth") {
    return getV3GuestMetadata(nicoId);
  }
};

const getV3GuestMetadata = async (nicoId: string): Promise<watchV3Metadata> => {
  const req = await fetch(
    `https://www.nicovideo.jp/api/watch/v3_guest/${nicoId}?_frontendId=6&_frontendVersion=0&actionTrackId=0_0`
  );
  const metadata = (await req.json()) as unknown;
  if (!typeGuard.niconico.watchV3Metadata(metadata)) {
    throw new Error(`failed to get metadata\n${encodeJson(metadata)}`);
  }
  return metadata;
};

const download = async (
  nicoId: string,
  format: NicovideoFormat,
  path: string,
  progress: (total: number, downloaded: number) => void
) => {
  const metadata = await getMetadata(nicoId);
  if (!metadata) {
    sendMessageToController({
      title: "動画情報の取得に失敗しました",
      message: "動画が削除などされていないか確認してください",
      type: "message",
    });
    return;
  }
  if (!metadata.data.media.delivery) {
    sendMessageToController({
      title: "動画情報の取得に失敗しました",
      message: "未購入の有料動画などの可能性があります",
      type: "message",
    });
    return;
  }
  if (metadata.data.media.delivery.trackingId) {
    const trackingReq = await fetch(
      `https://nvapi.nicovideo.jp/v1/2ab0cbaa/watch?${new URLSearchParams({
        t: metadata.data.media.delivery.trackingId,
      }).toString()}`,
      {
        method: "GET",
        headers: {
          "X-Frontend-Id": "6",
          "X-Frontend-Version": "0",
        },
      }
    );
    if (trackingReq.status !== 200) {
      console.warn("動画のダウンロードに失敗する可能性があります");
    }
  }
  const requestBody = createSessionCreateRequestBody(metadata, format);
  const req = await fetch("https://api.dmc.nico/api/sessions?_format=json", {
    method: "POST",
    headers: {
      Origin: "https://www.nicovideo.jp",
      Referer: "https://www.nicovideo.jp",
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(requestBody),
  });
  const res = (await req.json()) as unknown;
  if (!typeGuard.niconico.createSessionResponse(res)) {
    sendMessageToController({
      title: "セッションの作成に失敗しました",
      message:
        "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください",
      type: "message",
    });
    return;
  }
  let lastSession = res.data;
  const heartbeatInterval = setInterval(() => {
    void (async () => {
      const req = await fetch(
        `https://api.dmc.nico/api/sessions/${lastSession.session.id}?_format=json&_method=PUT`,
        {
          method: "POST",
          headers: {
            Origin: "https://www.nicovideo.jp",
            Referer: "https://www.nicovideo.jp",
            "Content-Type": "text/plain;charset=UTF-8",
          },
          body: JSON.stringify(lastSession),
        }
      );
      const res = (await req.json()) as unknown;
      if (!typeGuard.niconico.createSessionResponse(res)) {
        sendMessageToController({
          title: "セッションの更新に失敗しました",
          message:
            "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください",
          type: "message",
        });
        throw new Error("failed to renew session");
      }
      lastSession = res.data;
    })();
  }, 30 * 1000);

  let total = 0,
    downloaded = 0;
  const onData = (data: string) => {
    let match;
    if ((match = data.match(/Duration: ([0-9:.]+),/))) {
      total = time2num(match[1]);
    } else if ((match = data.match(/time=([0-9:.]+) /))) {
      downloaded = time2num(match[1]);
    }
    progress(total, downloaded);
  };
  const result = await spawn(
    ffmpegPath,
    ["-i", lastSession.session.content_uri, "-c", "copy", path, "-y"],
    undefined,
    onData,
    onData
  );
  clearInterval(heartbeatInterval);
  const delReq = await fetch(
    `https://api.dmc.nico/api/sessions/${lastSession.session.id}?_format=json&_method=DELETE`,
    {
      method: "POST",
      headers: {
        Origin: "https://www.nicovideo.jp",
        Referer: "https://www.nicovideo.jp",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify(lastSession),
    }
  );
  await delReq.json();
  return result;
};

const time2num = (time: string) => {
  let second = 0;
  let offset = 0;
  while (time) {
    const index = time.lastIndexOf(":");
    second += Math.pow(60, offset++) * Number(time.slice(index + 1));
    time = index < 0 ? "" : time.slice(0, index);
  }
  return second;
};

const createSessionCreateRequestBody = (
  metadata: watchV3Metadata,
  format: NicovideoFormat
): createSessionRequest => {
  const sessionBody: createSessionRequest = {
    session: {
      client_info: {
        player_id: metadata.data.media.delivery.movie.session.playerId,
      },
      content_auth: {
        auth_type: "ht2",
        content_key_timeout: 600000,
        service_id: "nicovideo",
        service_user_id:
          metadata.data.media.delivery.movie.session.serviceUserId,
      },
      content_id: metadata.data.media.delivery.movie.contentId,
      content_src_id_sets: [
        {
          content_src_ids: [
            {
              src_id_to_mux: {
                audio_src_ids: [format.audio],
                video_src_ids: [format.video],
              },
            },
          ],
        },
      ],
      content_type: "movie",
      content_uri: "",
      keep_method: {
        heartbeat: {
          lifetime:
            metadata.data.media.delivery.movie.session.heartbeatLifetime,
        },
      },
      priority: metadata.data.media.delivery.movie.session.priority,
      protocol: {
        name: "http",
        parameters: {
          http_parameters: {
            parameters: {
              hls_parameters: {
                segment_duration: 6000,
                transfer_preset:
                  metadata.data.media.delivery.movie.session
                    .transferPresets[0] || "",
                use_ssl: "yes",
                use_well_known_port: "yes",
              },
            },
          },
        },
      },
      recipe_id: metadata.data.media.delivery.recipeId,
      session_operation_auth: {
        session_operation_auth_by_signature: {
          signature: metadata.data.media.delivery.movie.session.signature,
          token: metadata.data.media.delivery.movie.session.token,
        },
      },
      timing_constraint: "unlimited",
    },
  };
  if (metadata.data.media.delivery.encryption) {
    sessionBody.session.protocol.parameters.http_parameters.parameters.hls_parameters.encryption =
      {
        hls_encryption_v1: {
          encrypted_key: metadata.data.media.delivery.encryption.encryptedKey,
          key_uri: metadata.data.media.delivery.encryption.keyUri,
        },
      };
  }
  return sessionBody;
};

export { getMetadata, download, getUserInfo };
