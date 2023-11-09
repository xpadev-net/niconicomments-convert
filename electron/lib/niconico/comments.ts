import type { FormattedComment } from "@xpadev-net/niconicomments";
import NiconiComments from "@xpadev-net/niconicomments";
import * as fs from "fs";
import { JSDOM } from "jsdom";

import type { CommentQueue } from "@/@types/queue";
import type { V1Raw } from "@/@types/types";

import { sleep } from "../../utils";

const downloadComment = async (
  queue: CommentQueue,
  updateProgress: (total: number, progress: number) => void,
): Promise<void> => {
  const formattedComments = await downloadV3V1Comment(queue, updateProgress);
  const xml = convertToXml(formattedComments);
  fs.writeFileSync(queue.path, xml, "utf-8");
};

const convertToXml = (comments: FormattedComment[]): string => {
  const jsdom = new JSDOM();
  const parser = new jsdom.window.DOMParser();
  const document = parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?><packet></packet>`,
      "application/xhtml+xml",
    ),
    packet = document.getElementsByTagName("packet")[0];
  for (const comment of comments) {
    const chat = document.createElement("chat");
    chat.setAttribute("no", `${comment.id}`);
    chat.setAttribute("vpos", `${comment.vpos}`);
    chat.innerText = chat.textContent = comment.content;
    chat.setAttribute("date", `${comment.date}`);
    chat.setAttribute("date_usec", `${comment.date_usec}`);
    chat.setAttribute("owner", `${comment.owner ? 1 : 0}`);
    chat.setAttribute("premium", `${comment.premium ? 1 : 0}`);
    chat.setAttribute("mail", comment.mail.join(" "));
    packet.append(chat);
  }
  return document.documentElement.outerHTML;
};

const downloadV3V1Comment = async (
  queue: CommentQueue,
  updateProgress: (total: number, progress: number) => void,
): Promise<FormattedComment[]> => {
  const userList = [];
  const comments: FormattedComment[] = [];
  const start = Math.floor(new Date(queue.option.start).getTime() / 1000);
  const threadTotal = queue.option.threads.filter(
    (thread) => thread.enable,
  ).length;
  const total =
    queue.option.end.type === "date"
      ? start - Math.floor(new Date(queue.option.end.date).getTime() / 1000)
      : queue.option.end.count;
  let threadId = 0;
  for (const thread of queue.option.threads) {
    if (!thread.enable) continue;
    const threadComments: FormattedComment[] = [];
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
      const threads = (res as V1Raw)?.data?.threads;
      if (!NiconiComments.typeGuard.v1.threads(threads))
        throw new Error("failed to get comments");
      for (const thread of threads) {
        const forkName = thread.fork;
        for (const comment of thread.comments) {
          const tmpParam: FormattedComment = {
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
            is_my_post: false,
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
          queue.option.end.count * threadId + threadComments.length,
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

export { downloadComment };
