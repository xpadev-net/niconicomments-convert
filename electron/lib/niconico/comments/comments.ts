import * as fs from "node:fs";
import type { FormattedComment } from "@xpadev-net/niconicomments";
import NiconiComments from "@xpadev-net/niconicomments";
import { Builder } from "@xpadev-net/xml2js";

import type {
  TCommentOptionCustom,
  TCommentOptionSimple,
  V3MetadataComment,
} from "@/@types/niconico";
import type { CommentQueue } from "@/@types/queue";
import type { V1Raw } from "@/@types/types";

import { sendMessageToController } from "../../../controller-window";
import {
  type BaseData,
  downloadCustomComment,
  stopDownloadCustomComment,
} from "./custom-comment-downloader";
import { convertV3ToFormatted } from "./utils";

let interrupt = false;

const downloadComment = async (
  queue: CommentQueue,
  updateProgress: (total: number, progress: number, message?: string) => void,
): Promise<void> => {
  try {
    const formattedComments =
      queue.option.type === "simple"
        ? await downloadV3V1SimpleComment(
            queue.option,
            queue.metadata,
            updateProgress,
          )
        : await downloadV3V1CustomComment(
            queue.option,
            queue.metadata,
            updateProgress,
          );
    const xml = convertToXml(formattedComments);
    fs.writeFileSync(queue.path, xml, "utf-8");
  } catch (e) {
    sendMessageToController({
      type: "message",
      title: "コメントのダウンロードに失敗しました",
      message: `コメントのダウンロードに失敗しました\n動画が存在しているか、ログインできているか確認してみてください\n${e}\nlib/niconico/comments.ts / downloadComment`,
    });
  }
};

const convertToXml = (comments: FormattedComment[]): string => {
  const builder = new Builder();
  return builder.buildObject({
    packet: {
      $: {
        version: "20061206",
      },
      chat: comments.map((comment) => ({
        _: comment.content,
        $: {
          no: comment.id,
          vpos: comment.vpos,
          date: comment.date,
          date_usec: comment.date_usec,
          user_id: comment.user_id,
          mail: comment.mail.join(" "),
          premium: comment.premium ? 1 : 0,
          anonymity: comment.owner ? 1 : 0,
        },
      })),
    },
  });
};

const downloadV3V1SimpleComment = async (
  option: TCommentOptionSimple,
  metadata: V3MetadataComment,
  updateProgress: (total: number, progress: number) => void,
): Promise<FormattedComment[]> => {
  const userList: string[] = [];
  const targetThreads = option.threads.filter((thread) => thread.enable);
  const body = {
    threadKey: metadata.nvComment.threadKey,
    params: {
      language: metadata.nvComment.params.language,
      targets: targetThreads.map((thread) => ({
        id: `${thread.threadId}`,
        fork: thread.forkLabel,
      })),
    },
    additionals: {},
  };
  const req = await fetch(`${metadata.nvComment.server}/v1/threads`, {
    method: "POST",
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      "x-client-os-type": "others",
      "x-frontend-id": "6",
      "x-frontend-version": "0",
    },
    body: JSON.stringify(body),
  });
  const res = (await req.json()) as unknown;
  const threads = (res as V1Raw)?.data?.threads;
  if (!NiconiComments.typeGuard.v1.threads(threads))
    throw new Error("failed to get comments");
  updateProgress(1, 1);
  return convertV3ToFormatted(threads, userList);
};

const downloadV3V1CustomComment = async (
  option: TCommentOptionCustom,
  metadata: V3MetadataComment,
  updateProgress: (total: number, progress: number) => void,
): Promise<FormattedComment[]> => {
  interrupt = false;
  const userList: string[] = [];
  const comments: FormattedComment[] = [];
  const start = Math.floor(new Date(option.start).getTime() / 1000);
  const threadTotal = option.threads.filter((thread) => thread.enable).length;
  const total =
    option.end.type === "date"
      ? start - Math.floor(new Date(option.end.date).getTime() / 1000)
      : option.end.count;
  let threadId = 0;
  for (const thread of option.threads) {
    if (!thread.enable) continue;
    if (interrupt) break;
    const when = Math.floor(new Date(option.start).getTime() / 1000);
    const baseData: BaseData = {
      threadKey: metadata.nvComment.threadKey,
      params: {
        language: metadata.nvComment.params.language,
        targets: [
          {
            id: `${thread.threadId}`,
            fork: thread.forkLabel,
          },
        ],
      },
    };
    const threadComments = await downloadCustomComment(
      option,
      metadata,
      updateProgress,
      baseData,
      when,
      total,
      threadTotal,
      threadId,
      start,
      userList,
    );
    comments.push(...threadComments);
    threadId++;
  }
  return comments;
};

const interruptCommentDownload = (): void => {
  interrupt = true;
  stopDownloadCustomComment();
};

export { downloadComment, interruptCommentDownload };
