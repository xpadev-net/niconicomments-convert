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

import { sleep } from "../../../utils";
import {
  type BaseData,
  downloadCustomComment,
} from "./custom-comment-downloader";
import { convertV3ToFormatted } from "./utils";

const downloadComment = async (
  queue: CommentQueue,
  updateProgress: (total: number, progress: number, message?: string) => void,
  signal: AbortSignal,
): Promise<void> => {
  signal.throwIfAborted();
  const formattedComments =
    queue.option.type === "simple"
      ? await downloadV3V1SimpleComment(
          queue.option,
          queue.metadata,
          updateProgress,
          signal,
        )
      : await downloadV3V1CustomComment(
          queue.option,
          queue.metadata,
          updateProgress,
          signal,
        );
  signal.throwIfAborted();
  const xml = convertToXml(formattedComments);
  fs.writeFileSync(queue.path, xml, "utf-8");
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
          // 投稿者コメントは user_id 属性が存在しないことで判定されるため、
          // 内部的に割り当てた匿名の user_id を出力に含めない
          // https://github.com/xpadev-net/niconicomments-convert/issues/357
          user_id: comment.owner ? undefined : comment.user_id,
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
  signal: AbortSignal,
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
    signal,
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
  updateProgress: (total: number, progress: number, message?: string) => void,
  signal: AbortSignal,
): Promise<FormattedComment[]> => {
  const userList: string[] = [];
  const comments: FormattedComment[][] = [];
  const start = Math.floor(new Date(option.start).getTime() / 1000);
  const threadTotal = option.threads.filter((thread) => thread.enable).length;
  const total =
    option.end.type === "date"
      ? start - Math.floor(new Date(option.end.date).getTime() / 1000)
      : option.end.count;
  let threadId = 0;
  for (const thread of option.threads) {
    if (!thread.enable) continue;
    signal.throwIfAborted();
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
    comments.push(
      await downloadCustomComment(
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
        signal,
      ),
    );
    threadId++;
    await sleep(1000);
  }
  return comments.flat(1);
};

export { downloadComment };
