import type {
  TCommentOptionCustom,
  V3MetadataComment,
} from "@/@types/niconico";
import type { V1Raw } from "@/@types/types";
import NiconiComments, {
  type FormattedComment,
} from "@xpadev-net/niconicomments";
import { sleep } from "../../../utils";
import { convertV3ToFormatted } from "./utils";

export type BaseData = {
  threadKey: string;
  params: {
    language: string;
    targets: {
      id: string;
      fork: string;
    }[];
  };
};

let baseData: BaseData;
let when: number;
let option: TCommentOptionCustom;
let metadata: V3MetadataComment;
let progress: (total: number, progress: number) => void;
let interrupt: boolean;
let userList: string[];
let threadComments: FormattedComment[];
let resolve: (comments: FormattedComment[]) => void;
let total: number;
let threadTotal: number;
let threadId: number;
let start: number;

export const downloadCustomComment = async (
  _option: TCommentOptionCustom,
  _metadata: V3MetadataComment,
  _progress: (total: number, progress: number) => void,
  _baseData: BaseData,
  _when: number,
  _total: number,
  _threadTotal: number,
  _threadId: number,
  _start: number,
  _userList: string[],
) => {
  interrupt = false;
  userList = _userList;
  threadComments = [];
  baseData = _baseData;
  when = _when;
  progress = _progress;
  option = _option;
  metadata = _metadata;
  total = _total;
  threadTotal = _threadTotal;
  threadId = _threadId;
  start = _start;

  return new Promise<FormattedComment[]>((_resolve) => {
    resolve = _resolve;
    download();
  });
};

export const stopDownloadCustomComment = () => {
  interrupt = true;
};

const download = async () => {
  if (interrupt) {
    resolve(threadComments);
    return;
  }
  await sleep(100);
  const req = await fetch(`${metadata.nvComment.server}/v1/threads`, {
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
  const thread = (res as V1Raw)?.data?.threads[0];
  if (!NiconiComments.typeGuard.v1.thread(thread))
    throw new Error("failed to get comments");
  const oldestCommentDate = new Date(
    Math.min(
      ...thread.comments.map((comment) => {
        return new Date(comment.postedAt).getTime();
      }),
    ),
  );
  when = Math.floor(oldestCommentDate.getTime() / 1000);
  threadComments.push(...convertV3ToFormatted([thread], userList));
  if (option.end.type === "date") {
    progress(total * threadTotal, total * threadId + start - when);
  } else {
    progress(
      option.end.count * threadTotal,
      option.end.count * threadId + threadComments.length,
    );
  }
  if (
    thread.comments.length < 5 ||
    threadComments[threadComments.length - 1]?.id < 5
  ) {
    resolve(threadComments);
    return;
  }
  setTimeout(download, 0);
};
