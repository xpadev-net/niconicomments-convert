import * as fs from "node:fs";
import * as Stream from "node:stream";
import { parseStringPromise } from "@xpadev-net/xml2js";

import type { UUID } from "@/@types/brand";
import type { ConvertQueue, Queue, QueueLists } from "@/@types/queue";
import type { ApiResponseLoad } from "@/@types/response.renderer";

import { sendMessageToController } from "./controller-window";
import { inputStream, interruptConverter, startConverter } from "./converter";
import { encodeError } from "./lib/json";
import { getLogger } from "./lib/log";
import {
  download,
  downloadComment,
  interruptCommentDownload,
} from "./lib/niconico";
import { interruptDMC } from "./lib/niconico/dmc";
import { interruptDMS } from "./lib/niconico/dms";
import { createRendererWindow, sendMessageToRenderer } from "./renderer-window";

const logger = getLogger("[queue]");

const queueList: Queue[] = [];
const queueLists: QueueLists = {
  convert: [],
  movie: [],
  comment: [],
};
let convertQueue = Promise.resolve();
let processingQueue: ConvertQueue;
let lastFrame = 0;
let endFrame = -1;
const frameQueue: { [key: number]: Uint8Array } = {};
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
  targetQueue.progress.percent = 0;
  sendProgress();
  try {
    await download(
      targetQueue.url,
      targetQueue.format,
      targetQueue.path,
      (total, downloaded) => {
        targetQueue.progress.percent = downloaded / total;
        sendProgress();
      },
    );
    targetQueue.status = "completed";
  } catch (e) {
    logger.error("failed to download movie", e);
    targetQueue.status = "fail";
    sendMessageToController({
      type: "message",
      title: "動画のダウンロード中にエラーが発生しました",
      message: `エラー内容:\n${encodeError(e)}`,
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
  targetQueue.progress.percent = 0;
  sendProgress();
  try {
    await downloadComment(targetQueue, (total, downloaded) => {
      targetQueue.progress.percent = downloaded / total;
      sendProgress();
    });
    targetQueue.status = "completed";
  } catch (e) {
    logger.error("failed to download comment", e);
    targetQueue.status = "fail";
    sendMessageToController({
      type: "message",
      title: "コメントのダウンロード中にエラーが発生しました",
      message: `エラー内容:\n${encodeError(e)}`,
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
  for (const queueId of queued[0].wait ?? []) {
    const queue = queueList.filter((i) => i.id === queueId)[0];
    if (queue?.status !== "completed") return;
  }
  try {
    processingQueue = queued[0];
    processingQueue.status = "processing";
    processingQueue.progress.percent = 0;
    lastFrame = 0;
    createRendererWindow();
    sendProgress();
    await startConverter(queued[0]);
    if (processingQueue.status === "processing")
      processingQueue.status = "completed";
  } catch (e) {
    logger.error("failed to convert", e);
    processingQueue.status = "fail";
    sendMessageToController({
      type: "message",
      title: "書き出し中にエラーが発生しました",
      message: `エラー内容:\n${encodeError(e)}`,
    });
  }
  sendMessageToRenderer({
    type: "end",
  });
  sendProgress();
  void startConvert();
};

const appendFrame = (frameId: number, data: Uint8Array): void => {
  frameQueue[frameId] = data;
  if (frameId !== lastFrame + 1) {
    return;
  }
  while (frameQueue[lastFrame + 1]) {
    lastFrame++;
    processFrame(frameQueue[lastFrame]);
    delete frameQueue[lastFrame];
  }
  if (lastFrame === endFrame) {
    void convertQueue.then(() => inputStream.end());
  }
};

const processFrame = (data: Uint8Array): void => {
  if (processingQueue.status !== "processing") return;
  convertQueue = convertQueue.then(() =>
    new Promise<void>((fulfill, reject) => {
      const myStream = new Stream.Readable();
      myStream._read = () => {
        myStream.push(data);
        myStream.push(null);
      };
      processingQueue.progress.percent++;
      sendProgress();
      return myStream
        .on("end", () => fulfill())
        .on("error", (err) => reject(err))
        .pipe(inputStream, { end: false });
    }).catch((e) => {
      console.warn(e);
    }),
  );
};
const markAsCompleted = (frameId: number): void => {
  endFrame = frameId;
};
const sendProgress = (): void => {
  sendMessageToController({
    type: "progress",
    data: queueList,
  });
  typeof processingQueue?.progress === "number" &&
    processingQueue.status === "processing" &&
    sendMessageToRenderer({
      type: "reportProgress",
      converted: processingQueue.progress,
    });
};

const processOnLoad = async (): Promise<ApiResponseLoad> => {
  const queue = processingQueue;
  let commentData = fs.readFileSync(queue.comment.path, "utf-8");
  if (queue.comment.format === "xml2js") {
    commentData = JSON.stringify(
      await parseStringPromise(commentData, { includeWhiteChars: true }),
    );
  }
  return {
    type: "load",
    commentData,
    queue,
  };
};

const processOnInterrupt = (queueId: UUID): void => {
  const queue = queueList.filter((i) => i.id === queueId)[0];
  if (!queue || queue.status !== "processing") return;
  queue.status = "interrupted";
  if (queue.type === "convert") {
    void convertQueue
      .then(() => inputStream.end())
      .then(() => {
        interruptConverter();
        sendMessageToRenderer({
          type: "end",
        });
      });
  } else if (queue.type === "movie") {
    if (queue.format.type === "dmc") interruptDMC();
    if (queue.format.type === "dms") interruptDMS();
  } else if (queue.type === "comment") {
    interruptCommentDownload();
  }
};

export {
  appendFrame,
  appendQueue,
  markAsCompleted,
  processingQueue,
  processOnInterrupt,
  processOnLoad,
  queueLists,
  sendProgress,
};
