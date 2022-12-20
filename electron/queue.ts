import { Queue } from "@/@types/queue";
import { inputStream, startConverter } from "./converter";
import { createRendererWindow, sendMessageToRenderer } from "./rendererWindow";
import { base64ToUint8Array } from "./utils";
import * as Stream from "stream";
import { sendMessageToController } from "./controllerWindow";

const queueList: Queue[] = [];
let convertQueue = Promise.resolve();
let processingQueue: Queue;
const appendQueue = (queue: Queue) => {
  queueList.push(queue);
  if (queueList.filter((i) => i.status !== "completed").length === 1) {
    void startConvert();
  }
};

const startConvert = async () => {
  const queued = queueList.filter((i) => i.status === "queued");
  if (
    queueList.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !queued[0]
  )
    return;
  processingQueue = queued[0];
  processingQueue.status = "processing";
  createRendererWindow();
  await startConverter(queued[0]);
  sendMessageToRenderer({
    type: "end",
  });
  processingQueue.status = "completed";
  void startConvert();
};
const appendBuffers = (blobs: string[]) => {
  for (const key in blobs) {
    const item = blobs[key];
    const base64Image = item.split(";base64,").pop();

    convertQueue = convertQueue.then(() =>
      new Promise<void>((fulfill, reject) => {
        const myStream = new Stream.Readable();
        myStream._read = () => {
          const u8 = base64ToUint8Array(base64Image);
          myStream.push(u8);
          myStream.push(null);
        };
        processingQueue.progress.converted++;
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
  queueList,
};
