import type { CreateSessionRequest, TWatchV3Metadata } from "@/@types/niconico";
import type { TDMCFormat } from "@/@types/queue";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "../../controller-window";
import { typeGuard } from "../../type-guard";
import { DownloadM3U8 } from "../../utils/ffmpeg";

let stop: (() => void) | undefined;

const downloadDMC = async (
  metadata: TWatchV3Metadata,
  format: TDMCFormat,
  path: string,
  progress: (total: number, downloaded: number, eta: number) => void,
): Promise<SpawnResult | undefined> => {
  if (!typeGuard.niconico.v3DMC(metadata)) {
    if (typeGuard.niconico.v3DMS(metadata)) {
      sendMessageToController({
        title: "動画情報の取得に失敗しました",
        message:
          "DMC上に動画が見つかりませんでした\nDMSからの取得を試してみてください\nlib/niconico/dmc.ts / downloadDMC / invalid server",
        type: "message",
      });
      return;
    }
    sendMessageToController({
      title: "動画情報の取得に失敗しました",
      message:
        "未購入の有料動画などの可能性があります\nlib/niconico/dmc.ts / downloadDMC / invalid metadata",
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
      },
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
  if (!typeGuard.niconico.CreateSessionResponse(res)) {
    sendMessageToController({
      title: "セッションの作成に失敗しました",
      message:
        "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください\nlib/niconico/dmc.ts / downloadDMC / invalid session",
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
        },
      );
      const res = (await req.json()) as unknown;
      if (!typeGuard.niconico.CreateSessionResponse(res)) {
        sendMessageToController({
          title: "セッションの更新に失敗しました",
          message:
            "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください\nlib/niconico/dmc.ts / downloadDMC / invalid session",
          type: "message",
        });
        throw new Error("failed to renew session");
      }
      lastSession = res.data;
    })();
  }, 30 * 1000);

  const { stop: _stop, promise } = DownloadM3U8(
    ["-i", lastSession.session.content_uri, "-c", "copy", path, "-y"],
    progress,
  );
  let cancelled = false;
  stop = () => {
    _stop();
    cancelled = true;
  };
  try {
    const result = await promise;
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
      },
    );
    await delReq.json();
    return result;
  } catch (e) {
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

const createSessionCreateRequestBody = (
  metadata: TWatchV3Metadata<"dmc">,
  format: TDMCFormat,
): CreateSessionRequest => {
  const sessionBody: CreateSessionRequest = {
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
                audio_src_ids: [format.format.audio],
                video_src_ids: [format.format.video],
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

const interruptDMC = (): void => {
  stop?.();
};

export { downloadDMC, interruptDMC };
