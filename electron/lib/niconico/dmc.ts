import type { CreateSessionRequest, V3MetadataBody } from "@/@types/niconico";
import type { TDMCFormat } from "@/@types/queue";
import type { SpawnResult } from "@/@types/spawn";

import { typeGuard } from "../../type-guard";
import { DownloadM3U8 } from "../../utils/ffmpeg";

const downloadDMC = async (
  metadata: V3MetadataBody,
  format: TDMCFormat,
  path: string,
  progress: (total: number, downloaded: number, eta: number) => void,
  signal: AbortSignal,
): Promise<SpawnResult> => {
  signal.throwIfAborted();
  if (!typeGuard.niconico.v3DMC(metadata)) {
    if (typeGuard.niconico.v3DMS(metadata)) {
      throw new Error(
        "DMC上に動画が見つかりませんでした\nDMSからの取得を試してみてください",
      );
    }
    throw new Error(
      "動画情報の取得に失敗しました。未購入の有料動画などの可能性があります",
    );
  }
  if (metadata.media.delivery.trackingId) {
    const trackingReq = await fetch(
      `https://nvapi.nicovideo.jp/v1/2ab0cbaa/watch?${new URLSearchParams({
        t: metadata.media.delivery.trackingId,
      }).toString()}`,
      {
        signal,
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
    signal,
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
    throw new Error(
      "セッションの作成に失敗しました。時間をおいて再度試してみてください",
    );
  }
  signal.throwIfAborted();
  let lastSession = res.data;
  const { stop, promise } = DownloadM3U8(
    ["-i", lastSession.session.content_uri, "-c", "copy", path, "-y"],
    progress,
  );
  signal.addEventListener("abort", stop, { once: true });
  const heartbeatController = new AbortController();
  const heartbeatSignal = AbortSignal.any([signal, heartbeatController.signal]);
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  const heartbeatFailure = new Promise<never>((_resolve, reject) => {
    heartbeatInterval = setInterval(() => {
      void (async () => {
        const req = await fetch(
          `https://api.dmc.nico/api/sessions/${lastSession.session.id}?_format=json&_method=PUT`,
          {
            signal: heartbeatSignal,
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
          throw new Error("セッションの更新に失敗しました");
        }
        lastSession = res.data;
      })().catch(reject);
    }, 30 * 1000);
  });
  try {
    const result = await Promise.race([promise, heartbeatFailure]);
    signal.throwIfAborted();
    clearInterval(heartbeatInterval);
    heartbeatController.abort();
    const delReq = await fetch(
      `https://api.dmc.nico/api/sessions/${lastSession.session.id}?_format=json&_method=DELETE`,
      {
        signal,
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
    signal.throwIfAborted();
    return result;
  } catch (error) {
    stop();
    // Wait for ffmpeg to exit before the queue starts the next movie download.
    await promise.catch(() => {});
    throw error;
  } finally {
    clearInterval(heartbeatInterval);
    heartbeatController.abort();
    signal.removeEventListener("abort", stop);
  }
};

const createSessionCreateRequestBody = (
  metadata: V3MetadataBody<"dmc">,
  format: TDMCFormat,
): CreateSessionRequest => {
  const sessionBody: CreateSessionRequest = {
    session: {
      client_info: {
        player_id: metadata.media.delivery.movie.session.playerId,
      },
      content_auth: {
        auth_type: "ht2",
        content_key_timeout: 600000,
        service_id: "nicovideo",
        service_user_id: metadata.media.delivery.movie.session.serviceUserId,
      },
      content_id: metadata.media.delivery.movie.contentId,
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
          lifetime: metadata.media.delivery.movie.session.heartbeatLifetime,
        },
      },
      priority: metadata.media.delivery.movie.session.priority,
      protocol: {
        name: "http",
        parameters: {
          http_parameters: {
            parameters: {
              hls_parameters: {
                segment_duration: 6000,
                transfer_preset:
                  metadata.media.delivery.movie.session.transferPresets[0] ||
                  "",
                use_ssl: "yes",
                use_well_known_port: "yes",
              },
            },
          },
        },
      },
      recipe_id: metadata.media.delivery.recipeId,
      session_operation_auth: {
        session_operation_auth_by_signature: {
          signature: metadata.media.delivery.movie.session.signature,
          token: metadata.media.delivery.movie.session.token,
        },
      },
      timing_constraint: "unlimited",
    },
  };
  if (metadata.media.delivery.encryption) {
    sessionBody.session.protocol.parameters.http_parameters.parameters.hls_parameters.encryption =
      {
        hls_encryption_v1: {
          encrypted_key: metadata.media.delivery.encryption.encryptedKey,
          key_uri: metadata.media.delivery.encryption.keyUri,
        },
      };
  }
  return sessionBody;
};

export { downloadDMC };
