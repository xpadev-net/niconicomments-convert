import { ConvertQueue, Queue, QueueLists } from "@/@types/queue";
import { inputStream, startConverter } from "./converter";
import { createRendererWindow, sendMessageToRenderer } from "./rendererWindow";
import { base64ToUint8Array } from "./utils";
import * as Stream from "stream";
import { sendMessageToController } from "./controllerWindow";
import { download } from "./lib/niconico";

const queueList: Queue[] = [];
const queueLists: QueueLists = {
  convert: [],
  movie: [],
  comment: [],
};
let convertQueue = Promise.resolve();
let processingQueue: ConvertQueue;
const appendQueue = (queue: Queue) => {
  queueList.push(queue);
  if (queue.type === "convert") {
    queueLists.convert.push(queue);
    if (
      queueLists.convert.filter((i) => i.status !== "completed").length === 1
    ) {
      void startConvert();
    }
  } else if (queue.type === "movie") {
    queueLists.movie.push(queue);
    if (queueLists.movie.filter((i) => i.status !== "completed").length === 1) {
      void startMovieDownload();
    }
  } else if (queue.type === "comment") {
    queueLists.comment.push(queue);
    if (
      queueLists.comment.filter((i) => i.status !== "completed").length === 1
    ) {
      void startCommentDownload();
    }
  }
};

const startMovieDownload = async () => {
  const queued = queueLists.movie.filter((i) => i.status === "queued");
  if (
    queueLists.movie.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !queued[0]
  )
    return;
  const targetQueue = queued[0];
  targetQueue.status = "processing";
  sendProgress();
  await download(
    targetQueue.url,
    targetQueue.format,
    targetQueue.path,
    (total, downloaded) => {
      targetQueue.progress = downloaded / total;
      sendProgress();
    }
  );
  targetQueue.status = "completed";
  sendProgress();
  void startMovieDownload();
};

const startCommentDownload = () => {
  //todo: feat comment downloader
};

const startConvert = async () => {
  const queued = queueLists.convert.filter((i) => i.status === "queued");
  if (
    queueLists.convert.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !queued[0]
  )
    return;
  processingQueue = queued[0];
  processingQueue.status = "processing";
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
const appendBuffers = (blobs: string[]) => {
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
        processingQueue.progress.converted++;
        sendProgress();
        return myStream
          .on("end", () => fulfill())
          .on("error", () => reject())
          .pipe(inputStream, { end: false });
      }).catch((e) => {
        console.warn(e);
      })
    );
  }
};
const markAsCompleted = () => {
  void convertQueue.then(() => inputStream.end());
};
const updateProgress = (progress: number) => {
  processingQueue.progress.generated = progress;
  sendProgress();
};
const sendProgress = () => {
  sendMessageToController({
    type: "progress",
    data: queueList,
  });
  sendMessageToRenderer({
    type: "progress",
    data: processingQueue,
  });
};

export {
  appendQueue,
  markAsCompleted,
  appendBuffers,
  updateProgress,
  processingQueue,
  queueLists,
};
