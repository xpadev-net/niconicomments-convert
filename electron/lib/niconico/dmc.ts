import type {
  CreateSessionRequest,
  CreateSessionResponse,
  V3MetadataBody,
} from "@/@types/niconico";
import type { TDMCFormat } from "@/@types/queue";
import type { SpawnResult } from "@/@types/spawn";

import { typeGuard } from "../../type-guard";
import { DownloadM3U8 } from "../../utils/ffmpeg";
import { withRequestTimeout } from "./request";

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
  let lastSession: CreateSessionResponse["data"] | undefined;
  let downloader: ReturnType<typeof DownloadM3U8> | undefined;
  const heartbeatController = new AbortController();
  const heartbeatSignal = AbortSignal.any([signal, heartbeatController.signal]);
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  let heartbeatTask: Promise<void> | undefined;
  let result: SpawnResult;
  try {
    if (metadata.media.delivery.trackingId) {
      await withRequestTimeout(signal, async (requestSignal) => {
        const trackingReq = await fetch(
          `https://nvapi.nicovideo.jp/v1/2ab0cbaa/watch?${new URLSearchParams({
            t: metadata.media.delivery.trackingId,
          }).toString()}`,
          {
            signal: requestSignal,
            method: "GET",
            headers: {
              "X-Frontend-Id": "6",
              "X-Frontend-Version": "0",
            },
          },
        );
        // Tracking only needs the status; release its unused response body.
        await trackingReq.body?.cancel();
        if (trackingReq.status !== 200) {
          console.warn("動画のダウンロードに失敗する可能性があります");
        }
      });
    }
    const requestBody = createSessionCreateRequestBody(metadata, format);
    const res = await withRequestTimeout(signal, async (requestSignal) => {
      const req = await fetch(
        "https://api.dmc.nico/api/sessions?_format=json",
        {
          signal: requestSignal,
          method: "POST",
          headers: {
            Origin: "https://www.nicovideo.jp",
            Referer: "https://www.nicovideo.jp",
            "Content-Type": "text/plain;charset=UTF-8",
          },
          body: JSON.stringify(requestBody),
        },
      );
      return (await req.json()) as unknown;
    });
    if (!typeGuard.niconico.CreateSessionResponse(res)) {
      throw new Error(
        "セッションの作成に失敗しました。時間をおいて再度試してみてください",
      );
    }
    lastSession = res.data;
    signal.throwIfAborted();
    downloader = DownloadM3U8(
      ["-i", lastSession.session.content_uri, "-c", "copy", path, "-y"],
      progress,
    );
    signal.addEventListener("abort", downloader.stop, { once: true });
    signal.throwIfAborted();
    const heartbeatFailure = new Promise<never>((_resolve, reject) => {
      heartbeatInterval = setInterval(() => {
        if (heartbeatTask || heartbeatSignal.aborted) return;
        heartbeatTask = (async () => {
          const session = lastSession;
          if (!session) return;
          const res = await withRequestTimeout(
            heartbeatSignal,
            async (requestSignal) => {
              const req = await fetch(
                `https://api.dmc.nico/api/sessions/${session.session.id}?_format=json&_method=PUT`,
                {
                  signal: requestSignal,
                  method: "POST",
                  headers: {
                    Origin: "https://www.nicovideo.jp",
                    Referer: "https://www.nicovideo.jp",
                    "Content-Type": "text/plain;charset=UTF-8",
                  },
                  body: JSON.stringify(session),
                },
              );
              return (await req.json()) as unknown;
            },
          );
          heartbeatSignal.throwIfAborted();
          if (!typeGuard.niconico.CreateSessionResponse(res)) {
            throw new Error("セッションの更新に失敗しました");
          }
          lastSession = res.data;
        })()
          .catch(reject)
          .finally(() => {
            heartbeatTask = undefined;
          });
      }, 30 * 1000);
    });
    result = await Promise.race([downloader.promise, heartbeatFailure]);
    signal.throwIfAborted();
  } catch (error) {
    downloader?.stop();
    throw error;
  } finally {
    clearInterval(heartbeatInterval);
    heartbeatController.abort();
    // Drain the aborted heartbeat before deleting the session it was updating.
    await heartbeatTask;
    // Wait for ffmpeg to exit before the queue starts the next movie download.
    await downloader?.promise.catch(() => {});
    if (downloader) signal.removeEventListener("abort", downloader.stop);
    if (lastSession) {
      const session = lastSession;
      try {
        await withRequestTimeout(
          // An already cancelled job still needs a bounded cleanup attempt.
          signal.aborted ? undefined : signal,
          async (requestSignal) => {
            const req = await fetch(
              `https://api.dmc.nico/api/sessions/${session.session.id}?_format=json&_method=DELETE`,
              {
                signal: requestSignal,
                method: "POST",
                headers: {
                  Origin: "https://www.nicovideo.jp",
                  Referer: "https://www.nicovideo.jp",
                  "Content-Type": "text/plain;charset=UTF-8",
                },
                body: JSON.stringify(session),
              },
            );
            await req.json();
          },
          5_000,
        );
      } catch (error) {
        if (!signal.aborted)
          console.warn("failed to delete DMC session", error);
      }
    }
  }
  signal.throwIfAborted();
  return result;
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
