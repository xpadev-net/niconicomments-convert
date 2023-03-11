import { store } from "../store";
import { authType } from "@/@types/setting";
import { typeGuard } from "../typeGuard";
import { convertToEncodedCookie, getCookies } from "./cookie";
import { CommentQueue, NicovideoFormat } from "@/@types/queue";
import { sendMessageToController } from "../controllerWindow";
import {
  createSessionRequest,
  UserData,
  watchV3Metadata,
} from "@/@types/niconico";
import { spawn } from "./spawn";
import { ffmpegPath } from "../ffmpeg";
import { encodeJson } from "./json";
import NiconiComments, { formattedComment } from "@xpadev-net/niconicomments";
import { JSDOM } from "jsdom";
import { v1Raw } from "@/@types/types";
import * as fs from "fs";
import { sleep } from "../utils";
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
      type: "message",
      title: "動画情報の取得に失敗しました",
      message:
        "動画が削除などされていないか確認してください\nniconico / download / failed to get metadata",
    });
    return;
  }
  if (!metadata.data.media.delivery) {
    sendMessageToController({
      title: "動画情報の取得に失敗しました",
      message:
        "未購入の有料動画などの可能性があります\nniconico / download / invalid metadata",
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
        "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください\nniconico / download / failed to create session",
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
            "時間をおいて再度試してみてください\n解決しない場合は開発者までお問い合わせください\nniconico / download / failed to renew session",
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

const downloadComment = async (
  queue: CommentQueue,
  updateProgress: (total, progress) => void
) => {
  const formattedComments = await (async () => {
    if (queue.api === "v3+legacy") {
      return await downloadV3LegacyComment(queue, updateProgress);
    } else if (queue.api === "v3+v1") {
      return await downloadV3V1Comment(queue, updateProgress);
    }
  })();
  const xml = convertToXml(formattedComments);
  fs.writeFileSync(queue.path, xml, "utf-8");
};

const convertToXml = (comments: formattedComment[]) => {
  const jsdom = new JSDOM();
  const parser = new jsdom.window.DOMParser();
  const document = parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?><packet></packet>`,
      "application/xhtml+xml"
    ),
    packet = document.getElementsByTagName("packet")[0];
  for (const comment of comments) {
    const chat = document.createElement("chat");
    chat.setAttribute("no", `${comment.id}`);
    chat.setAttribute("vpos", `${comment.vpos}`);
    chat.innerHTML = comment.content;
    chat.setAttribute("date", `${comment.date}`);
    chat.setAttribute("date_usec", `${comment.date_usec}`);
    chat.setAttribute("owner", `${comment.owner ? 1 : 0}`);
    chat.setAttribute("premium", `${comment.premium ? 1 : 0}`);
    chat.setAttribute("mail", comment.mail.join(" "));
    packet.append(chat);
  }
  return document.documentElement.outerHTML;
};

const downloadV3LegacyComment = async (
  queue: CommentQueue,
  updateProgress: (total, progress) => void
) => {
  const userList = [];
  const comments: formattedComment[] = [];
  const start = Math.floor(new Date(queue.option.start).getTime() / 1000);
  const threadTotal = queue.option.threads.filter(
    (thread) => thread.enable
  ).length;
  const total =
    queue.option.end.type === "date"
      ? start - Math.floor(new Date(queue.option.end.date).getTime() / 1000)
      : queue.option.end.count;
  let threadId = 0;
  for (const thread of queue.option.threads) {
    if (!thread.enable) continue;
    const threadComments: formattedComment[] = [];
    let when = Math.floor(new Date(queue.option.start).getTime() / 1000);
    while (
      (queue.option.end.type === "date" &&
        when > Math.floor(new Date(queue.option.end.date).getTime() / 1000)) ||
      (queue.option.end.type === "count" &&
        threadComments.length < queue.option.end.count)
    ) {
      await sleep(1000);
      const req = await fetch(
        `${queue.metadata.threads[0].server}/api.json/thread?version=20090904&scores=1&nicoru=3&fork=${thread.fork}&language=0&thread=${thread.threadId}&res_from=-1000&when=${when}`
      );
      const res = (await req.json()) as unknown;
      if (!NiconiComments.typeGuard.legacy.rawApiResponses(res))
        throw new Error("failed to get comments");
      for (const itemWrapper of res) {
        for (const key of Object.keys(itemWrapper)) {
          const value = itemWrapper[key];
          if (!value) continue;
          if (!NiconiComments.typeGuard.legacy.apiChat(value)) continue;
          if (value.deleted !== 1) {
            const tmpParam: formattedComment = {
              id: value.no,
              vpos: value.vpos,
              content: value.content || "",
              date: value.date,
              date_usec: value.date_usec || 0,
              owner: !value.user_id,
              premium: value.premium === 1,
              mail: [],
              user_id: -1,
              layer: -1,
            };
            if (value.mail) {
              tmpParam.mail = value.mail.split(/\s+/g);
            }
            if (value.content.startsWith("/") && !value.user_id) {
              tmpParam.mail.push("invisible");
            }
            const isUserExist = userList.indexOf(value.user_id);
            if (isUserExist === -1) {
              tmpParam.user_id = userList.length;
              userList.push(value.user_id);
            } else {
              tmpParam.user_id = isUserExist;
            }
            threadComments.push(tmpParam);
            if (when > value.date) {
              when = value.date;
            }
          }
        }
      }
      if (queue.option.end.type === "date") {
        updateProgress(total * threadTotal, total * threadId + start - when);
      } else {
        updateProgress(
          queue.option.end.count * threadTotal,
          queue.option.end.count * threadId + threadComments.length
        );
      }
      if (res.length < 100 || threadComments[threadComments.length - 1]?.id < 5)
        break;
    }
    comments.push(...threadComments);
    threadId++;
  }
  return comments;
};

const downloadV3V1Comment = async (
  queue: CommentQueue,
  updateProgress: (total, progress) => void
) => {
  const userList = [];
  const comments: formattedComment[] = [];
  const start = Math.floor(new Date(queue.option.start).getTime() / 1000);
  const threadTotal = queue.option.threads.filter(
    (thread) => thread.enable
  ).length;
  const total =
    queue.option.end.type === "date"
      ? start - Math.floor(new Date(queue.option.end.date).getTime() / 1000)
      : queue.option.end.count;
  let threadId = 0;
  for (const thread of queue.option.threads) {
    if (!thread.enable) continue;
    const threadComments: formattedComment[] = [];
    const when = Math.floor(new Date(queue.option.start).getTime() / 1000);
    const baseData = {
      threadKey: queue.metadata.nvComment.threadKey,
      params: {
        language: queue.metadata.nvComment.params.language,
        targets: [
          {
            id: `${thread.threadId}`,
            fork: thread.forkLabel,
          },
        ],
      },
    };
    while (
      (queue.option.end.type === "date" &&
        when > Math.floor(new Date(queue.option.end.date).getTime() / 1000)) ||
      (queue.option.end.type === "count" &&
        threadComments.length < queue.option.end.count)
    ) {
      await sleep(1000);
      const req = await fetch(`${queue.metadata.nvComment.server}/v1/threads`, {
        method: "POST",
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          "x-client-os-type": "others",
          "x-frontend-id": "6",
          "x-frontend-version": "0",
        },
        body: JSON.stringify({
          ...baseData,
          additionals: {
            res_from: -1000,
            when: when,
          },
        }),
      });
      const res = (await req.json()) as unknown;
      const threads = (res as v1Raw)?.data?.threads;
      if (!NiconiComments.typeGuard.v1.threads(threads))
        throw new Error("failed to get comments");
      for (const thread of threads) {
        const forkName = thread.fork;
        for (const comment of thread.comments) {
          const tmpParam: formattedComment = {
            id: comment.no,
            vpos: Math.floor(comment.vposMs / 10),
            content: comment.body,
            date: date2time(comment.postedAt),
            date_usec: 0,
            owner: forkName === "owner",
            premium: comment.isPremium,
            mail: comment.commands,
            user_id: -1,
            layer: -1,
          };
          if (tmpParam.content.startsWith("/") && tmpParam.owner) {
            tmpParam.mail.push("invisible");
          }
          const isUserExist = userList.indexOf(comment.userId);
          if (isUserExist === -1) {
            tmpParam.user_id = userList.length;
            userList.push(comment.userId);
          } else {
            tmpParam.user_id = isUserExist;
          }
          threadComments.push(tmpParam);
        }
      }
      if (queue.option.end.type === "date") {
        updateProgress(total * threadTotal, total * threadId + start - when);
      } else {
        updateProgress(
          queue.option.end.count * threadTotal,
          queue.option.end.count * threadId + threadComments.length
        );
      }
      if (
        threads.length < 5 ||
        threadComments[threadComments.length - 1]?.id < 5
      )
        break;
    }
    comments.push(...threadComments);
    threadId++;
  }
  return comments;
};

/**
 * v1 apiのpostedAtはISO 8601のtimestampなのでDate関数を使ってunix timestampに変換
 * @param date {string} ISO 8601 timestamp
 * @return {number} unix timestamp
 */
const date2time = (date: string): number =>
  Math.floor(new Date(date).getTime() / 1000);

export { getMetadata, download, getUserInfo, downloadComment };
