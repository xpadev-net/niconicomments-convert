import * as fs from "fs";
import * as Stream from "stream";

import type { ConvertQueue, Queue, QueueLists } from "@/@types/queue";
import type { ApiResponseLoad } from "@/@types/response.renderer";

import { sendMessageToController } from "./controllerWindow";
import { inputStream, startConverter } from "./converter";
import { encodeJson } from "./lib/json";
import { download, downloadComment } from "./lib/niconico";
import { createRendererWindow, sendMessageToRenderer } from "./rendererWindow";
import { base64ToUint8Array } from "./utils";

const queueList: Queue[] = [];
const queueLists: QueueLists = {
  convert: [],
  movie: [],
  comment: [],
};
let convertQueue = Promise.resolve();
let processingQueue: ConvertQueue;
const appendQueue = (queue: Queue): void => {
  queueList.push(queue);
  if (queue.type === "convert") {
    queueLists.convert.push(queue);
    if (queue.comment.type === "remote") {
      queueList.push(queue.comment.ref);
      queueLists.comment.push(queue.comment.ref);
      void startCommentDownload();
    }
    if (queue.movie.type === "remote") {
      queueList.push(queue.movie.ref);
      queueLists.movie.push(queue.movie.ref);
      void startMovieDownload();
    }
    void startConvert();
  } else if (queue.type === "movie") {
    queueLists.movie.push(queue);
    void startMovieDownload();
  } else if (queue.type === "comment") {
    queueLists.comment.push(queue);
    void startCommentDownload();
  }
};

const startMovieDownload = async (): Promise<void> => {
  const queued = queueLists.movie.filter((i) => i.status === "queued");
  const targetQueue = queued[0];
  if (
    queueLists.movie.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !targetQueue
  )
    return;

  targetQueue.status = "processing";
  targetQueue.progress = 0;
  sendProgress();
  try {
    await download(
      targetQueue.url,
      targetQueue.format,
      targetQueue.path,
      (total, downloaded) => {
        targetQueue.progress = downloaded / total;
        sendProgress();
      },
    );
    targetQueue.status = "completed";
  } catch (e) {
    targetQueue.status = "fail";
    sendMessageToController({
      type: "message",
      title: "動画のダウンロード中にエラーが発生しました",
      message: `エラー内容:\n${encodeJson(e)}`,
    });
  }
  sendProgress();
  void startMovieDownload();
  void startConvert();
};

const startCommentDownload = async (): Promise<void> => {
  const queued = queueLists.comment.filter((i) => i.status === "queued");
  const targetQueue = queued[0];
  if (
    queueLists.comment.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !targetQueue
  )
    return;
  targetQueue.status = "processing";
  targetQueue.progress = 0;
  sendProgress();
  try {
    await downloadComment(targetQueue, (total, downloaded) => {
      targetQueue.progress = downloaded / total;
      sendProgress();
    });
    targetQueue.status = "completed";
  } catch (e) {
    targetQueue.status = "fail";
    sendMessageToController({
      type: "message",
      title: "コメントのダウンロード中にエラーが発生しました",
      message: `エラー内容:\n${encodeJson(e)}`,
    });
  }
  sendProgress();
  void startCommentDownload();
  void startConvert();
};

const startConvert = async (): Promise<void> => {
  const queued = queueLists.convert.filter((i) => i.status === "queued");
  if (
    queueLists.convert.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !queued[0]
  )
    return;
  console.log(queued[0].wait);
  for (const queueId of queued[0].wait ?? []) {
    const queue = queueList.filter((i) => i.id === queueId)[0];
    if (queue?.status !== "completed") return;
  }
  processingQueue = queued[0];
  processingQueue.status = "processing";
  processingQueue.progress = 0;
  createRendererWindow();
  sendProgress();
  await startConverter(queued[0]);
  sendMessageToRenderer({
    type: "end",
  });
  processingQueue.status = "completed";
  sendProgress();
  void startConvert();
};
const appendBuffers = (blobs: string[]): void => {
  for (const item of blobs) {
    const base64Image = item.split(";base64,").pop();
    if (!base64Image) continue;
    convertQueue = convertQueue.then(() =>
      new Promise<void>((fulfill, reject) => {
        const myStream = new Stream.Readable();
        myStream._read = () => {
          const u8 = base64ToUint8Array(base64Image);
          myStream.push(u8);
          myStream.push(null);
        };
        processingQueue.progress++;
        sendProgress();
        return myStream
          .on("end", () => fulfill())
          .on("error", () => reject())
          .pipe(inputStream, { end: false });
      }).catch((e) => {
        console.warn(e);
      }),
    );
  }
};
const markAsCompleted = (): void => {
  void convertQueue.then(() => inputStream.end());
};
const sendProgress = (): void => {
  sendMessageToController({
    type: "progress",
    data: queueList,
  });
  typeof processingQueue?.progress === "number" &&
    sendMessageToRenderer({
      type: "reportProgress",
      converted: processingQueue.progress,
    });
};

const processOnLoad = (): ApiResponseLoad => {
  const queue = processingQueue;
  const commentData = fs.readFileSync(queue.comment.path, "utf-8");
  return {
    type: "load",
    commentData,
    queue,
  };
};

export {
  appendBuffers,
  appendQueue,
  markAsCompleted,
  processingQueue,
  processOnLoad,
  queueLists,
  sendProgress,
};
